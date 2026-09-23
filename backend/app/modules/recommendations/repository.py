from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.environments.models import Environment
from app.modules.resources.models import Resource
from app.shared.enums import EnvironmentType


class RecommendationRepository:
    """Consultas de leitura para o cálculo efêmero de recomendações."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_candidate_environments(
        self,
        *,
        environment_types: list[EnvironmentType],
        location_id: int | None,
    ) -> list[Environment]:
        query = (
            select(Environment)
            .options(
                selectinload(Environment.requirements),
                selectinload(Environment.policies),
            )
            .where(Environment.active.is_(True))
            .order_by(Environment.id)
        )
        if environment_types:
            query = query.where(Environment.type.in_(environment_types))
        if location_id is not None:
            query = query.where(Environment.location_id == location_id)
        return list(self.db.execute(query).scalars().all())

    def list_active_resources(self) -> list[Resource]:
        query = select(Resource).where(Resource.active.is_(True)).order_by(Resource.id)
        return list(self.db.execute(query).scalars().all())
