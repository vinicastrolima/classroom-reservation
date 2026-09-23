from app.modules.recommendations.ranking import (
    CandidateConfiguration,
    rank_candidates,
    score_candidate,
)
from app.modules.recommendations.repository import RecommendationRepository
from app.modules.recommendations.schemas import (
    EnvironmentRecommendationRead,
    RecommendationCriteria,
    RecommendationResponse,
    RecommendedResourceRead,
)
from app.modules.reservations import conflict_checker
from app.modules.reservations.repository import ReservationRepository
from app.modules.reservations.schemas import assert_operating_hours
from app.modules.resources.models import Resource
from app.modules.users.models import User
from app.shared.enums import ResourceAttachment, ResourceType


class RecommendationService:
    def __init__(
        self,
        *,
        repository: RecommendationRepository,
        reservation_repository: ReservationRepository,
    ) -> None:
        self.repository = repository
        self.reservation_repository = reservation_repository

    def recommend(
        self,
        *,
        criteria: RecommendationCriteria,
        current_user: User,
    ) -> RecommendationResponse:
        assert_operating_hours(criteria.start_time, criteria.end_time)
        resources = self.repository.list_active_resources()
        candidates: list[CandidateConfiguration] = []

        for environment in self.repository.list_candidate_environments(
            environment_types=criteria.environment_types,
            location_id=criteria.location_id,
        ):
            if environment.capacity < criteria.participant_count:
                continue
            selected_resources = _select_resources(
                environment_id=environment.id,
                resources=resources,
                required_types=criteria.required_resource_types,
            )
            if selected_resources is None:
                continue

            report = conflict_checker.check_reservation(
                repository=self.reservation_repository,
                environment=environment,
                start=criteria.start_time,
                end=criteria.end_time,
                participant_count=criteria.participant_count,
                resource_ids=[resource.id for resource in selected_resources],
                requester_id=current_user.id,
                requester_role_ids=[role.role_id for role in current_user.user_roles],
                required_support=criteria.support_types,
                lock_conflicts=False,
            )
            if report.has_conflicts:
                continue

            score, reasons = score_candidate(
                environment=environment,
                resources=selected_resources,
                participant_count=criteria.participant_count,
                required_resource_count=len(criteria.required_resource_types),
            )
            candidates.append(
                CandidateConfiguration(
                    environment=environment,
                    resources=selected_resources,
                    score=score,
                    reasons=reasons,
                )
            )

        ranked = rank_candidates(candidates=candidates, strategy=criteria.strategy)
        recommendations = [
            EnvironmentRecommendationRead(
                environment=candidate.environment,
                resources=[RecommendedResourceRead.model_validate(resource) for resource in candidate.resources],
                support_types=criteria.support_types,
                strategy=criteria.strategy,
                score=candidate.score,
                reasons=candidate.reasons,
            )
            for candidate in ranked[: criteria.limit]
        ]
        return RecommendationResponse(
            recommendations=recommendations,
            message=(
                "Nenhuma configuração atende às restrições informadas."
                if not recommendations
                else None
            ),
        )


def _select_resources(
    *,
    environment_id: int,
    resources: list[Resource],
    required_types: list[ResourceType],
) -> list[Resource] | None:
    selected: list[Resource] = []
    used_ids: set[int] = set()
    for resource_type in required_types:
        compatible = sorted(
            (
                resource
                for resource in resources
                if resource.id not in used_ids
                and resource.type == resource_type
                and (
                    resource.attachment_type == ResourceAttachment.MOBILE
                    or resource.environment_id == environment_id
                )
            ),
            key=lambda resource: (
                resource.attachment_type != ResourceAttachment.FIXED,
                resource.id,
            ),
        )
        if not compatible:
            return None
        selected_resource = compatible[0]
        selected.append(selected_resource)
        used_ids.add(selected_resource.id)
    return selected
