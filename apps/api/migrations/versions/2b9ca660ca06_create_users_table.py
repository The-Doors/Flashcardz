"""create users table

Revision ID: 2b9ca660ca06
Revises: 
Create Date: 2026-10-06 18:37:17.493315

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2b9ca660ca06'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(
            ["id"], ["auth.users.id"], name="users_id_fkey", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username", name="users_username_key"),
        schema="public",
    )
    op.execute("ALTER TABLE public.users ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table("users", schema="public")
