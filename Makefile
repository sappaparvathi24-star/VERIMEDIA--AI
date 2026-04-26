.PHONY: install dev test lint build migrate seed clean help

## ── Install ──────────────────────────────────────────────────────────────
install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install
	@echo "✅ Dependencies installed"

## ── Development ──────────────────────────────────────────────────────────
dev:
	@echo "🚀 Starting VeriMedia dev servers..."
	@cp -n .env.example .env 2>/dev/null || true
	docker compose up db redis minio -d
	@sleep 2
	cd backend && uvicorn app.main:app --reload --port 8000 &
	cd frontend && npm run dev

dev-docker:
	docker compose up --build

## ── Testing ──────────────────────────────────────────────────────────────
test:
	cd backend && pytest tests/ -v --cov=app --cov-report=term-missing
	cd frontend && npm run test

test-backend:
	cd backend && pytest tests/ -v --cov=app

test-frontend:
	cd frontend && npm run test

## ── Lint / Format ────────────────────────────────────────────────────────
lint:
	cd backend && ruff check app/ tests/ && black --check app/ tests/
	cd frontend && npm run lint

format:
	cd backend && black app/ tests/ && ruff check --fix app/ tests/
	cd frontend && npm run format

typecheck:
	cd frontend && npm run type-check

## ── Database ─────────────────────────────────────────────────────────────
migrate:
	cd backend && alembic upgrade head

migrate-create:
	cd backend && alembic revision --autogenerate -m "$(name)"

seed:
	cd backend && python -m app.utils.seed

## ── Production Build ─────────────────────────────────────────────────────
build:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml build

deploy:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

## ── Cleanup ──────────────────────────────────────────────────────────────
clean:
	docker compose down -v --remove-orphans
	find . -type d -name __pycache__ | xargs rm -rf
	find . -type d -name .pytest_cache | xargs rm -rf
	find . -name "*.pyc" -delete

## ── Help ─────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  VeriMedia AI — Dev Commands"
	@echo "  ────────────────────────────"
	@echo "  make install      Install all dependencies"
	@echo "  make dev          Start dev environment (backend + frontend)"
	@echo "  make dev-docker   Start via Docker Compose"
	@echo "  make test         Run all tests"
	@echo "  make lint         Lint all code"
	@echo "  make build        Production build"
	@echo "  make migrate      Run DB migrations"
	@echo "  make clean        Remove containers + caches"
	@echo ""
