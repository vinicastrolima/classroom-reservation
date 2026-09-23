import asyncio
from contextlib import asynccontextmanager
import time
from typing import Any

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import get_settings
from app.core.logging_middleware import StructuredLoggingMiddleware
from app.core.redis import check_redis_health
from app.core.scheduler import noshow_job, overtime_job, run_periodic
from app.db import models  # noqa: F401
from app.db.session import session_factory
from app.modules.audit.router import router as audit_router
from app.modules.auth.router import router as auth_router
from app.modules.environments.calendar_block_router import (
    router as calendar_block_router,
)
from app.modules.environments.router import router as environments_router
from app.modules.governance.router import router as governance_router
from app.modules.locations.router import router as locations_router
from app.modules.notifications.router import router as notifications_router
from app.modules.operations.router import router as operations_router
from app.modules.organizational_units.router import (
    router as organizational_units_router,
)
from app.modules.qualifications.router import router as qualifications_router
from app.modules.recommendations.router import router as recommendations_router
from app.modules.reservations.router import router as reservations_router
from app.modules.resources.availability_router import router as resource_availability_router
from app.modules.resources.maintenance_router import router as resource_maintenance_router
from app.modules.resources.router import router as resources_router
from app.modules.users.router import router as users_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    stop_event = asyncio.Event()
    tasks: list[asyncio.Task] = []
    if settings.noshow_job_enabled:
        tasks.append(
            asyncio.create_task(
                run_periodic(
                    noshow_job,
                    interval_seconds=settings.noshow_job_interval_seconds,
                    stop_event=stop_event,
                )
            )
        )
    if settings.overtime_job_enabled:
        tasks.append(
            asyncio.create_task(
                run_periodic(
                    overtime_job,
                    interval_seconds=settings.overtime_job_interval_seconds,
                    stop_event=stop_event,
                )
            )
        )
    try:
        yield
    finally:
        stop_event.set()
        for task in tasks:
            await task


app = FastAPI(
    title=settings.project_name,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Custom Middlewares
app.add_middleware(StructuredLoggingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def deep_healthcheck(response: Response) -> dict[str, Any]:
    """
    Comprehensive health check probing Database, Redis, and Scheduler components.
    Returns HTTP 200 if healthy/degraded, or HTTP 503 if critical dependencies fail.
    """
    health_status: dict[str, Any] = {
        "status": "healthy",
        "environment": settings.environment,
        "timestamp": time.time(),
        "components": {},
    }

    # 1. Database Health Check
    db_start = time.perf_counter()
    try:
        with session_factory() as db:
            db.execute(text("SELECT 1"))
        db_latency_ms = round((time.perf_counter() - db_start) * 1000, 2)
        health_status["components"]["database"] = {
            "status": "healthy",
            "latency_ms": db_latency_ms,
        }
    except Exception as exc:
        health_status["status"] = "unhealthy"
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "error": str(exc),
        }
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    # 2. Redis Health Check
    redis_health = check_redis_health()
    health_status["components"]["redis"] = redis_health
    if not redis_health.get("healthy", True) and settings.redis_enabled:
        if health_status["status"] != "unhealthy":
            health_status["status"] = "degraded"

    # 3. Scheduler Status
    health_status["components"]["scheduler"] = {
        "noshow_job": "running" if settings.noshow_job_enabled else "disabled",
        "overtime_job": "running" if settings.overtime_job_enabled else "disabled",
    }

    return health_status


# Include Feature Routers
app.include_router(environments_router)
app.include_router(calendar_block_router)
app.include_router(locations_router)
app.include_router(resource_availability_router)
app.include_router(resource_maintenance_router)
app.include_router(resources_router)
app.include_router(users_router)
app.include_router(auth_router)
app.include_router(organizational_units_router)
app.include_router(reservations_router)
app.include_router(recommendations_router)
app.include_router(qualifications_router)
app.include_router(notifications_router)
app.include_router(operations_router)
app.include_router(governance_router)
app.include_router(audit_router)
