import sys
import os
from logging.config import fileConfig

from sqlalchemy import pool
from alembic import context

# app パッケージを import できるようにパスを追加
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import engine, Base  # noqa: E402
import app.models  # noqa: F401,E402  – モデルを登録するためにインポート

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    import os
    url = os.getenv('DATABASE_URL') or config.get_main_option("sqlalchemy.url")
    if url and url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
    is_sqlite = (url or '').startswith('sqlite')
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=is_sqlite,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    is_sqlite = engine.url.drivername.startswith('sqlite')
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=is_sqlite,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
