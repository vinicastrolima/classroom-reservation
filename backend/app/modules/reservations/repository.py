from collections.abc import Iterable
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.reservations.models import (
    CalendarBlock,
    Reservation,
    ReservationResource,
)
from app.modules.reservations.state_machine import BLOCKING_STATUSES
from app.shared.enums import CalendarBlockType, ReservationStatus, SupportType
from app.shared.enums import UserRole as SharedUserRole


def _eager_options() -> tuple:
    return (
        selectinload(Reservation.resources),
        selectinload(Reservation.support),
    )


class ReservationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        environment_id: int | None = None,
        requester_id: int | None = None,
        status: ReservationStatus | None = None,
        start_after: datetime | None = None,
        end_before: datetime | None = None,
    ) -> list[Reservation]:
        query = select(Reservation).options(*_eager_options())
        if environment_id is not None:
            query = query.where(Reservation.environment_id == environment_id)
        if requester_id is not None:
            query = query.where(Reservation.requester_id == requester_id)
        if status is not None:
            query = query.where(Reservation.status == status)
        if start_after is not None:
            query = query.where(Reservation.end_time > start_after)
        if end_before is not None:
            query = query.where(Reservation.start_time < end_before)
        query = query.order_by(Reservation.start_time).offset(skip).limit(limit)
        return list(self.db.execute(query).scalars().unique().all())

    def list_pending(self, *, skip: int = 0, limit: int = 100) -> list[Reservation]:
        query = (
            select(Reservation)
            .options(*_eager_options())
            .where(Reservation.status == ReservationStatus.PENDING_APPROVAL)
            .order_by(Reservation.start_time)
            .offset(skip)
            .limit(limit)
        )
        return list(self.db.execute(query).scalars().unique().all())

    def get_by_id(self, reservation_id: int) -> Reservation | None:
        query = (
            select(Reservation)
            .options(*_eager_options())
            .where(Reservation.id == reservation_id)
        )
        return self.db.execute(query).scalars().unique().one_or_none()

    def get_overlapping(
        self,
        *,
        environment_id: int,
        start: datetime,
        end: datetime,
        exclude_id: int | None = None,
        statuses: Iterable[ReservationStatus] = BLOCKING_STATUSES,
        with_for_update: bool = False,
    ) -> list[Reservation]:
        query = (
            select(Reservation)
            .where(Reservation.environment_id == environment_id)
            .where(Reservation.status.in_(list(statuses)))
            .where(Reservation.start_time < end)
            .where(Reservation.end_time > start)
        )
        if exclude_id is not None:
            query = query.where(Reservation.id != exclude_id)
        if with_for_update:
            query = query.with_for_update()
        return list(self.db.execute(query).scalars().all())

    def get_resource_overlapping(
        self,
        *,
        resource_ids: list[int],
        start: datetime,
        end: datetime,
        exclude_id: int | None = None,
        statuses: Iterable[ReservationStatus] = BLOCKING_STATUSES,
    ) -> list[Reservation]:
        if not resource_ids:
            return []
        query = (
            select(Reservation)
            .join(
                ReservationResource,
                ReservationResource.reservation_id == Reservation.id,
            )
            .where(ReservationResource.resource_id.in_(resource_ids))
            .where(Reservation.status.in_(list(statuses)))
            .where(Reservation.start_time < end)
            .where(Reservation.end_time > start)
        )
        if exclude_id is not None:
            query = query.where(Reservation.id != exclude_id)
        return list(self.db.execute(query).scalars().unique().all())

    def get_inactive_or_missing_resource_ids(
        self, *, resource_ids: list[int]
    ) -> list[int]:
        if not resource_ids:
            return []
        from app.modules.resources.models import Resource

        found_ids = set(
            self.db.execute(
                select(Resource.id)
                .where(Resource.id.in_(resource_ids))
                .where(Resource.active.is_(True))
            )
            .scalars()
            .all()
        )
        return sorted(set(resource_ids) - found_ids)

    def get_resource_unavailability_overlapping(
        self, *, resource_ids: list[int], start: datetime, end: datetime
    ) -> list[tuple[int, str | None]]:
        if not resource_ids:
            return []
        from app.modules.resources.models import ResourceAvailability

        query = (
            select(ResourceAvailability.resource_id, ResourceAvailability.reason)
            .where(ResourceAvailability.resource_id.in_(resource_ids))
            .where(ResourceAvailability.available.is_(False))
            .where(ResourceAvailability.start < end)
            .where(ResourceAvailability.end > start)
        )
        return list(self.db.execute(query).all())

    def get_calendar_blocks_overlapping(
        self,
        *,
        environment_id: int,
        start: datetime,
        end: datetime,
        exclude_types: Iterable[CalendarBlockType] = (),
    ) -> list[CalendarBlock]:
        query = (
            select(CalendarBlock)
            .where(CalendarBlock.environment_id == environment_id)
            .where(CalendarBlock.start_time < end)
            .where(CalendarBlock.end_time > start)
        )
        excluded = list(exclude_types)
        if excluded:
            query = query.where(~CalendarBlock.type.in_(excluded))
        return list(self.db.execute(query).scalars().all())

    def add(self, reservation: Reservation) -> Reservation:
        self.db.add(reservation)
        self.db.commit()
        self.db.refresh(reservation)
        return reservation

    def save(self, reservation: Reservation) -> Reservation:
        self.db.add(reservation)
        self.db.commit()
        self.db.refresh(reservation)
        return reservation

    def has_technician_available(
        self,
        *,
        support_type: SupportType,
        start: datetime,
        end: datetime,
    ) -> bool:
        """Verifica se existe ao menos um técnico em escala cobrindo o intervalo.

        O parâmetro ``support_type`` é aceito para evolução futura; no schema
        atual ``TechnicianSchedule`` não diferencia tipos de suporte por técnico,
        então a checagem é apenas presença de escala válida com papel TECHNICIAN.
        """
        from app.modules.resources.models import TechnicianSchedule
        from app.modules.users.models import Role, UserRole

        technician_code = SharedUserRole.TECHNICIAN.value
        query = (
            select(TechnicianSchedule.id)
            .join(UserRole, UserRole.user_id == TechnicianSchedule.technician_id)
            .join(Role, Role.id == UserRole.role_id)
            .where(TechnicianSchedule.start_date <= start)
            .where(TechnicianSchedule.end_date >= end)
            .where(Role.code == technician_code)
            .limit(1)
        )
        return self.db.execute(query).first() is not None

    def flush(self) -> None:
        self.db.flush()
