from dataclasses import dataclass

from app.modules.environments.models import Environment
from app.modules.resources.models import Resource
from app.shared.enums import RecommendationStrategy


@dataclass(frozen=True)
class CandidateConfiguration:
    environment: Environment
    resources: list[Resource]
    score: int
    reasons: list[str]


def rank_candidates(
    *,
    candidates: list[CandidateConfiguration],
    strategy: RecommendationStrategy,
) -> list[CandidateConfiguration]:
    if strategy is RecommendationStrategy.FIRST_FIT:
        return sorted(candidates, key=lambda candidate: candidate.environment.id)
    return sorted(
        candidates,
        key=lambda candidate: (-candidate.score, candidate.environment.id),
    )


def score_candidate(
    *,
    environment: Environment,
    resources: list[Resource],
    participant_count: int,
    required_resource_count: int,
) -> tuple[int, list[str]]:
    unused_capacity = environment.capacity - participant_count
    capacity_score = max(0, 1_000 - unused_capacity * 10)
    extra_resources = max(0, len(resources) - required_resource_count)
    resource_score = max(0, 100 - extra_resources * 10)
    fixed_resource_count = sum(
        resource.environment_id == environment.id for resource in resources
    )
    fixed_resource_score = fixed_resource_count * 5
    score = capacity_score + resource_score + fixed_resource_score
    reasons = [
        f"Capacidade excedente de {unused_capacity} participante(s)",
        f"{fixed_resource_count} recurso(s) fixo(s) já disponível(is) no ambiente",
    ]
    return score, reasons
