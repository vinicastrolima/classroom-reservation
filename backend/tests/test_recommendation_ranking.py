from app.db import models as _models  # noqa: F401
from app.modules.environments.models import Environment
from app.modules.recommendations.ranking import (
    CandidateConfiguration,
    rank_candidates,
    score_candidate,
)
from app.modules.resources.models import Resource
from app.shared.enums import RecommendationStrategy, ResourceAttachment


def _environment(id: int, capacity: int) -> Environment:
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
        active=True,
    )


def test_first_fit_uses_stable_environment_id_order() -> None:
    later = CandidateConfiguration(_environment(8, 40), [], 500, [])
    first = CandidateConfiguration(_environment(2, 40), [], 500, [])

    ranked = rank_candidates(
        candidates=[later, first], strategy=RecommendationStrategy.FIRST_FIT
    )

    assert [candidate.environment.id for candidate in ranked] == [2, 8]


def test_weighted_score_prefers_lower_unused_capacity() -> None:
    smaller = _environment(3, 25)
    larger = _environment(1, 60)
    resource = Resource(
        id=1,
        name="Projetor",
        type="EQUIPMENT",
        category="AUDIOVISUAL",
        attachment_type=ResourceAttachment.FIXED,
        environment_id=3,
        active=True,
    )
    smaller_score, smaller_reasons = score_candidate(
        environment=smaller,
        resources=[resource],
        participant_count=20,
        required_resource_count=1,
    )
    larger_score, _ = score_candidate(
        environment=larger,
        resources=[],
        participant_count=20,
        required_resource_count=0,
    )

    ranked = rank_candidates(
        candidates=[
            CandidateConfiguration(larger, [], larger_score, []),
            CandidateConfiguration(smaller, [resource], smaller_score, smaller_reasons),
        ],
        strategy=RecommendationStrategy.WEIGHTED_SCORE,
    )

    assert [candidate.environment.id for candidate in ranked] == [3, 1]
    assert "Capacidade excedente de 5 participante(s)" in smaller_reasons
