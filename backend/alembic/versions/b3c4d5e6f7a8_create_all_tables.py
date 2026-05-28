"""create all tables

Revision ID: b3c4d5e6f7a8
Revises: 5a3096b8fcb5
Create Date: 2026-05-28

"""
from alembic import op

revision: str = 'b3c4d5e6f7a8'
down_revision = '5a3096b8fcb5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    import app.models  # noqa: F401 – 全モデルを Base に登録
    from app.database import Base
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    import app.models  # noqa: F401
    from app.database import Base
    Base.metadata.drop_all(bind=op.get_bind())
