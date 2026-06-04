"""
pytest 共通フィクスチャ。

API テスト（test_api.py）は `TestClient(app)` を `with` なしでモジュール直下に
生成しているため FastAPI の lifespan が発火せず、テーブル不在で全滅していた。
ここで app をインポートする前にテスト用の一時 SQLite を割り当て、
セッション開始時に create_all + seed_if_empty を実行して回帰を防ぐ。

注: database.py は import 時に DATABASE_URL を読むため、環境変数の設定は
    app 系モジュールのインポートより前（このファイルの先頭）で行う必要がある。
"""

import os
import tempfile

_TEST_DB_FD, _TEST_DB_PATH = tempfile.mkstemp(suffix=".db", prefix="test_political_")
os.close(_TEST_DB_FD)
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH}"
os.environ.setdefault("ADMIN_TOKEN", "test-admin-token")

import pytest  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _prepare_database():
    """テスト用 SQLite にスキーマを作成しデモデータを投入する。"""
    from app import models  # noqa: F401  # モデルを Base.metadata に登録するため
    from app.database import Base, SessionLocal, engine
    from app.seed import seed_if_empty

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_if_empty(db)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    try:
        os.remove(_TEST_DB_PATH)
    except OSError:
        pass
