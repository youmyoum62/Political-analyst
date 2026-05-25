.PHONY: setup-frontend setup-backend dev-frontend dev-backend smoke-api up down

setup-frontend:
	npm install

setup-backend:
	python -m venv backend/.venv
	. backend/.venv/bin/activate && pip install -r backend/requirements.txt

dev-frontend:
	npm run dev

dev-backend:
	cd backend && . .venv/bin/activate && uvicorn app.main:app --reload --port 8000

smoke-api:
	curl -fsS http://localhost:8000/health
	curl -fsS http://localhost:8000/politicians
	curl -fsS http://localhost:8000/ranking
	curl -fsS http://localhost:8000/analysis/1

up:
	docker compose up --build

down:
	docker compose down -v
