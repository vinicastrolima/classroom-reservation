from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.main import app
from app.modules.recommendations.router import get_recommendation_service
from app.modules.recommendations.schemas import RecommendationResponse


class _RecommendationServiceStub:
    def __init__(self) -> None:
        self.current_user: object | None = None

    def recommend(self, *, criteria: object, current_user: object) -> RecommendationResponse:
        self.current_user = current_user
        return RecommendationResponse(recommendations=[])


def _payload() -> dict[str, object]:
    start = datetime(2026, 10, 1, 10, tzinfo=UTC)
    return {
        "start_time": start.isoformat(),
        "end_time": (start + timedelta(hours=1)).isoformat(),
        "participant_count": 10,
    }


def test_recommendation_endpoint_requires_authentication() -> None:
    response = TestClient(app).post("/api/v1/recomendacoes/ambientes", json=_payload())

    assert response.status_code == 401


def test_recommendation_endpoint_uses_authenticated_user() -> None:
    service = _RecommendationServiceStub()
    user = SimpleNamespace(id=7)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_recommendation_service] = lambda: service
    try:
        response = TestClient(app).post(
            "/api/v1/recomendacoes/ambientes", json=_payload()
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"recommendations": [], "message": None}
    assert service.current_user is user
