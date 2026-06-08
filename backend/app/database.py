import os
import time
from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./political_score.db')

# Supabase / Heroku は "postgres://" を返すが SQLAlchemy は "postgresql://" を要求する
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

if DATABASE_URL.startswith('sqlite'):
    engine = create_engine(
        DATABASE_URL,
        connect_args={'check_same_thread': False},
        future=True,
    )
else:
    # Supabase pooler への接続が（特に GitHub Actions ランナーから）断続的に timeout する
    # 事象への対策:
    #   - connect_timeout: 1 回の接続試行を 10 秒で打ち切る（psycopg2 既定の長い TCP
    #     タイムアウトを短縮し、wait_for_db のリトライ回数を確保する）
    #   - pool_pre_ping: プールから取り出す接続の死活を確認し stale 接続を張り直す
    #   - pool_recycle: 長時間ジョブ中に pooler 側で切られた接続を 30 分で再確立する
    engine = create_engine(
        DATABASE_URL,
        connect_args={'connect_timeout': 10},
        pool_pre_ping=True,
        pool_recycle=1800,
        future=True,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def wait_for_db(
    max_attempts: int = 8, base_delay: float = 5.0, max_delay: float = 30.0
) -> None:
    """DB へ接続できるまで指数バックオフでリトライする。

    Supabase pooler への接続が（特に GitHub Actions ランナーから）断続的に timeout
    する事象への対策。バッチ（ingest / recompute）の起動時に呼び、接続が確立できて
    から本処理に進む。全試行が失敗した場合は最後の例外を RuntimeError に包んで送出する。
    """
    last_err: BaseException | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text('SELECT 1'))
            if attempt > 1:
                print(f'  DB 接続成功（{attempt} 回目の試行）')
            return
        except OperationalError as exc:
            last_err = exc
            if attempt >= max_attempts:
                break
            delay = min(base_delay * 2 ** (attempt - 1), max_delay)
            print(
                f'  DB 接続失敗（{attempt}/{max_attempts}, {type(exc).__name__}）: '
                f'{delay:.0f}s 後に再試行'
            )
            time.sleep(delay)
    raise RuntimeError(
        f'DB へ {max_attempts} 回接続を試みましたが確立できませんでした'
    ) from last_err
