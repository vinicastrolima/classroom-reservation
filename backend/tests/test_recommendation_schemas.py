from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.modules.recommendations.schemas import RecommendationCriteria


def test_recommendation_criteria_accepts_valid_window() -> None:
    start = datetime(2026, 10, 1, 10, tzinfo=UTC)

    criteria = RecommendationCriteria(
        start_time=start,
        end_time=start + timedelta(hours=2),
        participant_count=30,
    )

    assert criteria.limit == 3
    assert criteria.required_resource_types == []


def test_recommendation_criteria_rejects_invalid_window() -> None:
    start = datetime(2026, 10, 1, 10, tzinfo=UTC)

    with pytest.raises(ValidationError, match="end_time deve ser maior"):
        RecommendationCriteria(
            start_time=start,
            end_time=start,
            participant_count=30,
        )


def test_recommendation_criteria_limits_results() -> None:
    start = datetime(2026, 10, 1, 10, tzinfo=UTC)

    with pytest.raises(ValidationError):
        RecommendationCriteria(
            start_time=start,
            end_time=start + timedelta(hours=1),
            participant_count=1,
            limit=11,
        )


def test_recommendation_criteria_rejects_outside_operating_hours() -> None:
    start = datetime(2026, 10, 1, 6, tzinfo=UTC)

    with pytest.raises(ValidationError, match="07:00"):
        RecommendationCriteria(
            start_time=start,
            end_time=start + timedelta(hours=1),
            participant_count=1,
        )
