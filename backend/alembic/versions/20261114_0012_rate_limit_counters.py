"""Fixed-window request counters for rate limiting (SEC-02).

Revision ID: 20261114_0012
Revises: 20261113_0011
Create Date: 2026-11-14
"""

import sqlalchemy as sa

from alembic import op

revision = "20261114_0012"
down_revision = "20261113_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rate_limit_counters",
        # Keyed hash of the rule name and what it counts (an IP, email,
        # user or session), so none of those values are stored.
        sa.Column("key_digest", sa.String(length=64), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("hits", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint(
            "key_digest", "window_start", name="pk_rate_limit_counters"
        ),
        sa.CheckConstraint("hits > 0", name="ck_rate_limit_counters_hits_positive"),
    )
    op.create_index(
        "ix_rate_limit_counters_window_start", "rate_limit_counters", ["window_start"]
    )


def downgrade() -> None:
    op.drop_index(
        "ix_rate_limit_counters_window_start", table_name="rate_limit_counters"
    )
    op.drop_table("rate_limit_counters")
