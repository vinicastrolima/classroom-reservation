from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.modules.recommendations.repository import RecommendationRepository
from app.modules.recommendations.schemas import (
    RecommendationCriteria,
    RecommendationResponse,
)
from app.modules.recommendations.service import RecommendationService
from app.modules.reservations.repository import ReservationRepository
from app.modules.users.models import User

router = APIRouter(prefix="/api/v1/recomendacoes", tags=["recommendations"])


def get_recommendation_service(db: Session = Depends(get_db)) -> RecommendationService:
    return RecommendationService(
        repository=RecommendationRepository(db=db),
        reservation_repository=ReservationRepository(db=db),
    )


@router.post("/ambientes", response_model=RecommendationResponse)
def recommend_environments(
    criteria: RecommendationCriteria,
    service: RecommendationService = Depends(get_recommendation_service),
    current_user: User = Depends(get_current_user),
) -> RecommendationResponse:
    return service.recommend(criteria=criteria, current_user=current_user)
