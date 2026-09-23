# syntax=docker/dockerfile:1
# ------------------------------------------------------------------------------
# Stage 1: Build virtual environment with uv
# ------------------------------------------------------------------------------
FROM python:3.14-slim AS builder

WORKDIR /build

ENV UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv

COPY --from=ghcr.io/astral-sh/uv:0.7.2 /uv /uvx /usr/local/bin/

COPY pyproject.toml uv.lock ./

RUN uv sync --frozen --no-install-project --no-dev --no-cache

# ------------------------------------------------------------------------------
# Stage 2: Production runtime with non-root security
# ------------------------------------------------------------------------------
FROM python:3.14-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/sh -m appuser

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY --from=builder /opt/venv /opt/venv
COPY . /app

RUN chmod +x /app/start.sh && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["/app/start.sh"]
