SHELL := bash

LOCAL_DB_URL := postgresql://postgres:postgres@localhost:5433/app

.PHONY: install migrate migrate-container run run-backend run-frontend help

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install backend and frontend dependencies
	cd backend && uv sync
	cd frontend && npm install

migrate: ## Run Alembic migrations against local DB
	cd backend && DATABASE_URL=$(LOCAL_DB_URL) uv run alembic upgrade head

migrate-container: ## Run Alembic migrations inside the running backend container
	docker compose exec backend /opt/venv/bin/alembic upgrade head

run: ## Start backend and frontend (Ctrl+C stops both)
	@trap 'kill 0' EXIT; \
	(cd backend && DATABASE_URL=$(LOCAL_DB_URL) uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) & \
	(cd frontend && npm run dev) & \
	wait

run-backend: ## Start only the backend
	cd backend && DATABASE_URL=$(LOCAL_DB_URL) uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

run-frontend: ## Start only the frontend
	cd frontend && npm run dev

.DEFAULT_GOAL := help
