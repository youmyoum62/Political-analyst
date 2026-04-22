# Quickstart (確認用)

## 1) 最短でUIだけ確認
```bash
npm install
npm run dev
```
Open: `http://localhost:3000`

## 2) APIをローカル実行して確認
```bash
python -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
cd backend && uvicorn app.main:app --reload --port 8000
```

別ターミナル:
```bash
curl http://localhost:8000/health
curl http://localhost:8000/politicians
curl http://localhost:8000/ranking
curl http://localhost:8000/analysis/1
```

## 3) APIテストを実行
```bash
source backend/.venv/bin/activate
cd backend && pytest
```

## 4) まとめて起動（Docker Compose）
```bash
docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Postgres: `localhost:5432`

停止:
```bash
docker compose down -v
```
