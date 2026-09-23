"""Validação centralizada de conflitos e restrições para criação/edição de reservas.

Bloqueios de calendário (``CalendarBlock``) bloqueiam a reserva, **inclusive**
buffers de outras reservas. Os buffers da própria reserva em edição são
ignorados via ``buffer_rules.filter_blocking``.

Qualificação do solicitante gera ``QUALIFICATION``.
Disponibilidade de equipe de suporte gera ``SUPPORT_UNAVAILABLE`` (conflito suave;
não bloqueia criação mas força status PENDING_APPROVAL).
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import select

from app.modules.environments.models import Environment
from app.modules.reservations.buffer_rules import filter_blocking
from app.modules.reservations.models import Reservation
from app.modules.reservations.repository import ReservationRepository
from app.shared.enums import SupportType

ConflictType = str  # SCHEDULE | RESOURCE | LEAD_TIME | CAPACITY | INACTIVE_ENV | QUALIFICATION | SUPPORT_UNAVAILABLE | CALENDAR_BLOCK

SUPPORT_UNAVAILABLE = "SUPPORT_UNAVAILABLE"


@dataclass(frozen=True)
class Conflict:
    type: ConflictType
    detail: str


@dataclass
class ConflictReport:
    conflicts: list[Conflict] = field(default_factory=list)

    @property
    def has_conflicts(self) -> bool:
        return bool(self.conflicts)

    def add(self, type: ConflictType, detail: str) -> None:
        self.conflicts.append(Conflict(type=type, detail=detail))


def check_reservation(
    *,
    repository: ReservationRepository,
    environment: Environment,
    start: datetime,
    end: datetime,
    participant_count: int,
    resource_ids: list[int],
    requester_id: int,
    requester_role_ids: list[int] | None = None,
    required_support: list[SupportType] | None = None,
    exclude_id: int | None = None,
    now: datetime | None = None,
    lock_conflicts: bool = True,
) -> ConflictReport:
    report = ConflictReport()

    if not environment.active:
        report.add("INACTIVE_ENV", "Ambiente inativo no momento da reserva")

    if participant_count > environment.capacity:
        report.add(
            "CAPACITY",
            f"Número de participantes ({participant_count}) "
            f"excede a capacidade do ambiente ({environment.capacity})",
        )

    _check_lead_time(
        report=report,
        environment=environment,
        start=start,
        requester_role_ids=requester_role_ids or [],
        now=now or datetime.now(start.tzinfo),
    )

    overlapping: list[Reservation] = repository.get_overlapping(
        environment_id=environment.id,
        start=start,
        end=end,
        exclude_id=exclude_id,
        with_for_update=lock_conflicts,
    )
    for clash in overlapping:
        report.add(
            "SCHEDULE",
            f"Conflito com reserva #{clash.id} "
            f"({clash.start_time:%d/%m/%Y %H:%M} – {clash.end_time:%H:%M})",
        )

    if resource_ids:
        invalid_resource_ids = repository.get_inactive_or_missing_resource_ids(
            resource_ids=resource_ids
        )
        for resource_id in invalid_resource_ids:
            report.add(
                "RESOURCE",
                f"Recurso #{resource_id} não está ativo ou não existe",
            )

        resource_clashes = repository.get_resource_overlapping(
            resource_ids=resource_ids,
            start=start,
            end=end,
            exclude_id=exclude_id,
        )
        for clash in resource_clashes:
            report.add(
                "RESOURCE",
                f"Recurso já alocado na reserva #{clash.id} "
                f"({clash.start_time:%d/%m/%Y %H:%M} – {clash.end_time:%H:%M})",
            )

        from app.modules.resources.maintenance_repository import (
            ResourceMaintenanceRepository,
        )

        maintenance = ResourceMaintenanceRepository(
            db=repository.db
        ).overlapping(resource_ids=resource_ids, start=start, end=end)
        for m in maintenance:
            report.add(
                "RESOURCE",
                f"Recurso #{m.resource_id} em manutenção de "
                f"{m.start_date:%d/%m/%Y %H:%M} a {m.end_date:%H:%M}",
            )

        unavailable_periods = repository.get_resource_unavailability_overlapping(
            resource_ids=resource_ids, start=start, end=end
        )
        for resource_id, reason in unavailable_periods:
            detail = f"Recurso #{resource_id} indisponível no período solicitado"
            if reason:
                detail = f"{detail}: {reason}"
            report.add("RESOURCE", detail)

    required_qual_ids = [r.qualification_id for r in environment.requirements]
    if required_qual_ids:
        from app.modules.qualifications.models import UserQualification

        held = (
            repository.db.execute(
                select(UserQualification.qualification_id)
                .where(UserQualification.user_id == requester_id)
                .where(UserQualification.qualification_id.in_(required_qual_ids))
            )
            .scalars()
            .all()
        )
        missing = set(required_qual_ids) - set(held)
        if missing:
            report.add(
                "QUALIFICATION",
                f"Solicitante não possui qualificações exigidas: {sorted(missing)}",
            )

    if required_support:
        # One DB round-trip covers all requested types: the current schema does not
        # differentiate technicians by support_type, so availability is all-or-nothing.
        technician_available = repository.has_technician_available(
            support_type=required_support[0], start=start, end=end
        )
        if not technician_available:
            for support_type in required_support:
                report.add(
                    SUPPORT_UNAVAILABLE,
                    f"Sem técnico disponível para {support_type.value}",
                )

    all_blocks = repository.get_calendar_blocks_overlapping(
        environment_id=environment.id,
        start=start,
        end=end,
    )
    for block in filter_blocking(all_blocks, exclude_reservation_id=exclude_id):
        report.add(
            "CALENDAR_BLOCK",
            f"Bloqueio {block.type} de {block.start_time:%d/%m/%Y %H:%M} "
            f"a {block.end_time:%H:%M}",
        )

    return report


def _check_lead_time(
    *,
    report: ConflictReport,
    environment: Environment,
    start: datetime,
    requester_role_ids: list[int],
    now: datetime,
) -> None:
    policies = [p for p in environment.policies if p.role_id in requester_role_ids]
    if not policies:
        return

    # Política mais restritiva entre os papéis do solicitante
    min_hours = max(p.min_lead_time_hours for p in policies)
    max_days = min(p.max_lead_time_days for p in policies)

    delta = start - now
    if delta < timedelta(hours=min_hours):
        report.add(
            "LEAD_TIME",
            f"Antecedência mínima de {min_hours}h não respeitada",
        )
    if delta > timedelta(days=max_days):
        report.add(
            "LEAD_TIME",
            f"Antecedência máxima de {max_days} dias excedida",
        )
