from datetime import datetime, time
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.shared.enums import (
    ReservationPurpose,
    ReservationStatus,
    ReservationType,
    SupportType,
)

_TIMEZONE = ZoneInfo("America/Sao_Paulo")
_OPEN = time(7, 0)  # 07:00 local
_CLOSE = time(22, 0)  # 22:00 local


def _local_time(dt: datetime) -> time:
    """Retorna o horário local de Brasília para um datetime (aware ou naive)."""
    if dt.tzinfo is not None:
        return dt.astimezone(_TIMEZONE).time()
    return dt.time()


def assert_operating_hours(start: datetime, end: datetime) -> None:
    """Levanta ValueError se start ou end estiver fora de 07:00–22:00 BRT."""
    if _local_time(start) < _OPEN:
        raise ValueError(
            "O início da reserva deve ser a partir das 07:00 (horário de Brasília)"
        )
    if _local_time(end) > _CLOSE:
        raise ValueError(
            "O término da reserva deve ser até as 22:00 (horário de Brasília)"
        )


def _assert_operating_hours(start: datetime, end: datetime) -> None:
    """Compatibilidade interna para os schemas de reserva existentes."""
    assert_operating_hours(start, end)


class ReservationResourceCreate(BaseModel):
    resource_id: int = Field(gt=0)


class ReservationResourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    resource_id: int


class ReservationSupportCreate(BaseModel):
    support_type: SupportType
    responsible_staff_id: int | None = Field(default=None, gt=0)


class ReservationSupportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    support_type: SupportType
    responsible_staff_id: int | None = None


class RecurrenceSpec(BaseModel):
    """Recorrência semanal simples: dias da semana (0=segunda) e número de ocorrências."""

    weekdays: list[int] = Field(min_length=1)
    occurrences: int = Field(gt=0, le=52)


class ReservationBase(BaseModel):
    environment_id: int = Field(gt=0)
    requester_id: int = Field(gt=0)
    responsible_id: int = Field(gt=0)
    start_time: datetime
    end_time: datetime
    purpose: ReservationPurpose
    participant_count: int = Field(ge=1)
    type: ReservationType = ReservationType.SIMPLE

    @model_validator(mode="after")
    def _validate_window_and_type(self) -> "ReservationBase":
        if self.end_time <= self.start_time:
            raise ValueError("end_time deve ser maior que start_time")
        _assert_operating_hours(self.start_time, self.end_time)
        if self.type in (
            ReservationType.COMPOSITE_PARENT,
            ReservationType.COMPOSITE_CHILD,
        ):
            raise ValueError(
                "Reservas compostas devem ser criadas via /api/v1/reservas/compostas"
            )
        return self


class ReservationCreate(ReservationBase):
    resources: list[ReservationResourceCreate] = Field(default_factory=list)
    support: list[ReservationSupportCreate] = Field(default_factory=list)
    accept_terms: bool = Field(default=False)
    recurrence: RecurrenceSpec | None = None

    @model_validator(mode="after")
    def _require_terms(self) -> "ReservationCreate":
        if not self.accept_terms:
            raise ValueError(
                "Aceite dos termos de responsabilidade é obrigatório (regra 6.4)"
            )
        return self

    @model_validator(mode="after")
    def _validate_recurrence(self) -> "ReservationCreate":
        if self.recurrence is not None and self.type is not ReservationType.RECURRING:
            raise ValueError("recurrence requer type=RECURRING")
        if self.type is ReservationType.RECURRING and self.recurrence is None:
            raise ValueError("type=RECURRING requer recurrence")
        return self


class ReservationUpdate(BaseModel):
    environment_id: int | None = Field(default=None, gt=0)
    responsible_id: int | None = Field(default=None, gt=0)
    start_time: datetime | None = None
    end_time: datetime | None = None
    purpose: ReservationPurpose | None = None
    participant_count: int | None = Field(default=None, ge=1)
    resources: list[ReservationResourceCreate] | None = None
    support: list[ReservationSupportCreate] | None = None

    @model_validator(mode="after")
    def _validate_window(self) -> "ReservationUpdate":
        if (
            self.start_time is not None
            and self.end_time is not None
            and self.end_time <= self.start_time
        ):
            raise ValueError("end_time deve ser maior que start_time")
        if self.start_time is not None and _local_time(self.start_time) < _OPEN:
            raise ValueError(
                "O início da reserva deve ser a partir das 07:00 (horário de Brasília)"
            )
        if self.end_time is not None and _local_time(self.end_time) > _CLOSE:
            raise ValueError(
                "O término da reserva deve ser até as 22:00 (horário de Brasília)"
            )
        return self


class ReservationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    environment_id: int
    requester_id: int
    responsible_id: int
    start_time: datetime
    end_time: datetime
    status: ReservationStatus
    type: ReservationType
    purpose: ReservationPurpose
    participant_count: int
    checkin_at: datetime | None = None
    checkout_at: datetime | None = None
    terms_accepted_at: datetime | None = None
    resources: list[ReservationResourceRead] = Field(default_factory=list)
    support: list[ReservationSupportRead] = Field(default_factory=list)


class ReservationCancel(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class ReservationDecision(BaseModel):
    comments: str | None = Field(default=None, max_length=1000)


class CompositeItemCreate(BaseModel):
    environment_id: int = Field(gt=0)
    start_time: datetime
    end_time: datetime
    participant_count: int = Field(ge=1)
    purpose: ReservationPurpose
    resources: list[ReservationResourceCreate] = Field(default_factory=list)
    support: list[ReservationSupportCreate] = Field(default_factory=list)
    critical: bool = False

    @model_validator(mode="after")
    def _validate_window(self) -> "CompositeItemCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time deve ser maior que start_time")
        _assert_operating_hours(self.start_time, self.end_time)
        return self


class CompositeReservationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    responsible_id: int = Field(gt=0)
    accept_terms: bool = Field(default=False)
    items: list[CompositeItemCreate] = Field(min_length=2)

    @model_validator(mode="after")
    def _require_terms(self) -> "CompositeReservationCreate":
        if not self.accept_terms:
            raise ValueError(
                "Aceite dos termos de responsabilidade é obrigatório (regra 6.4)"
            )
        return self


class CompositeItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reservation_id: int
    critical: bool
    order: int


class CompositeReservationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    items: list[CompositeItemRead] = Field(default_factory=list)


class ConflictRead(BaseModel):
    type: str
    detail: str


class SlotSuggestion(BaseModel):
    start_time: datetime
    end_time: datetime


class AvailabilityResponse(BaseModel):
    available: bool
    conflicts: list[ConflictRead] = Field(default_factory=list)
    suggestions: list[SlotSuggestion] = Field(default_factory=list)
