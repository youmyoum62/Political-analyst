FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini

EXPOSE 8000

# Render は PORT 環境変数でポートを注入する（ローカルは 8000 をデフォルト）
# --proxy-headers / --forwarded-allow-ips: Render のロードバランサ背後で
# X-Forwarded-For を信頼し、レート制限が実クライアントIPでキーイングできるようにする。
CMD sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"
