"""Add per-member weekly application goal.

Revision ID: 20260701_0010
Revises: 20260625_0009
Create Date: 2026-07-01
"""

import sqlalchemy as sa
from alembic import op

revision = "20260701_0010"
down_revision = "20260625_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workspace_memberships",
        sa.Column("weekly_goal", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("workspace_memberships", "weekly_goal")
