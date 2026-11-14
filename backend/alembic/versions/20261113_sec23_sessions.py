"""Store metadata for session management.

Revision ID: 20261113_sec23
Revises: 20261113_sec07
"""

import sqlalchemy as sa

from alembic import op

revision = "20261113_sec23"
down_revision = "20261113_sec07"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("authentication_sessions", sa.Column("user_agent", sa.String(512)))
    op.add_column("authentication_sessions", sa.Column("ip_prefix", sa.String(43)))


def downgrade() -> None:
    op.drop_column("authentication_sessions", "ip_prefix")
    op.drop_column("authentication_sessions", "user_agent")
