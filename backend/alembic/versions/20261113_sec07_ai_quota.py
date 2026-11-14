"""Persist AI usage reservations.

Revision ID: 20261113_sec07
Revises: 20260701_0010
"""

import sqlalchemy as sa

from alembic import op

revision = "20261113_sec07"
down_revision = "20260701_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_quota_buckets",
        sa.Column("scope", sa.String(16), primary_key=True),
        sa.Column("subject", sa.String(36), primary_key=True),
        sa.Column("window_start", sa.Date(), primary_key=True),
        sa.Column("used", sa.Integer(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("ai_quota_buckets")
