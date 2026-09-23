from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.environments.schemas import EnvironmentRead
from app.modules.reservations.schemas import assert_operating_hours
from app.shared.enums import (
    EnvironmentType,
    RecommendationStrategy,
    ResourceType,
    SupportType,
)


class RecommendationCriteria(BaseModel):
    start_time: datetime
    end_time: datetime
    participant_count: int = Field(ge=1)
    environment_types: list[EnvironmentType] = Field(default_factory=list)
    location_id: int | None = Field(default=None, gt=0)
    required_resource_types: list[ResourceType] = Field(default_factory=list)
    support_types: list[SupportType] = Field(default_factory=list)
    strategy: RecommendationStrategy = RecommendationStrategy.WEIGHTED_SCORE
    limit: int = Field(default=3, ge=1, le=10)

    @model_validator(mode="after")
    def _validate_window(self) -> "RecommendationCriteria":
        if self.end_time <= self.start_time:
            raise ValueError("end_time deve ser maior que start_time")
        assert_operating_hours(self.start_time, self.end_time)
        return self


class RecommendedResourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: ResourceType


class EnvironmentRecommendationRead(BaseModel):
    environment: EnvironmentRead
    resources: list[RecommendedResourceRead] = Field(default_factory=list)
    support_types: list[SupportType] = Field(default_factory=list)
    strategy: RecommendationStrategy
    score: int
    reasons: list[str] = Field(default_factory=list)


class RecommendationResponse(BaseModel):
    recommendations: list[EnvironmentRecommendationRead] = Field(default_factory=list)
    message: str | None = None
