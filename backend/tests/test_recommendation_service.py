from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from app.db import models as _models  # noqa: F401
from app.modules.environments.models import Environment
from app.modules.recommendations.schemas import RecommendationCriteria
from app.modules.recommendations.service import RecommendationService, _select_resources
from app.modules.reservations.conflict_checker import ConflictReport
from app.modules.resources.models import Resource
from app.shared.enums import ResourceAttachment, ResourceType


def _environment(id: int, capacity: int = 30) -> Environment:
    return Environment(
        id=id,
        code=f"A-{id}",
        name=f"Ambiente {id}",
        type="CLASSROOM",
        criticality="COMMON",
        capacity=capacity,
        location_id=1,
        operating_hours="07:00-22:00",
        requires_approval=False,
        buffer_before_min=0,
        buffer_after_min=0,
        noshow_tolerance_min=15,
        active=True,
    )


def _resource(
    *, id: int, environment_id: int | None, attachment: ResourceAttachment
) -> Resource:
    return Resource(
        id=id,
        name=f"Recurso {id}",
        type="EQUIPMENT",
        category="AUDIOVISUAL",
        attachment_type=attachment,
        environment_id=environment_id,
        active=True,
    )


def test_select_resources_prefers_fixed_resource_from_candidate_environment() -> None:
    resources = [
        _resource(id=1, environment_id=None, attachment=ResourceAttachment.MOBILE),
        _resource(id=2, environment_id=9, attachment=ResourceAttachment.FIXED),
        _resource(id=3, environment_id=8, attachment=ResourceAttachment.FIXED),
    ]

    selected = _select_resources(
        environment_id=9,
        resources=resources,
        required_types=[ResourceType.EQUIPMENT],
    )

    assert selected is not None
    assert [resource.id for resource in selected] == [2]


def test_select_resources_excludes_fixed_resource_from_another_environment() -> None:
    selected = _select_resources(
        environment_id=9,
        resources=[_resource(id=3, environment_id=8, attachment=ResourceAttachment.FIXED)],
        required_types=[ResourceType.EQUIPMENT],
    )

    assert selected is None


def test_recommendation_is_read_only_and_checks_without_locking() -> None:
    start = datetime(2026, 10, 1, 10, tzinfo=UTC)
    environment = _environment(7)
    resource = _resource(id=2, environment_id=7, attachment=ResourceAttachment.FIXED)
    repository = SimpleNamespace(
        list_candidate_environments=lambda **_: [environment],
        list_active_resources=lambda: [resource],
    )
    service = RecommendationService(
        repository=repository,
        reservation_repository=SimpleNamespace(),
    )
    criteria = RecommendationCriteria(
        start_time=start,
        end_time=start + timedelta(hours=1),
        participant_count=20,
        required_resource_types=[ResourceType.EQUIPMENT],
    )

    with patch(
        "app.modules.recommendations.service.conflict_checker.check_reservation",
        return_value=ConflictReport(),
    ) as check_reservation:
        response = service.recommend(
            criteria=criteria,
            current_user=SimpleNamespace(id=4, user_roles=[]),
        )

    assert len(response.recommendations) == 1
    assert response.recommendations[0].environment.id == 7
    assert response.recommendations[0].resources[0].id == 2
    assert check_reservation.call_args.kwargs["lock_conflicts"] is False
