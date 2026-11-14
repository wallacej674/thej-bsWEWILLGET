"""Throttle sign-in failures per source instead of locking whole accounts.

Replaces users.failed_login_attempts / users.locked_until (a lock anyone
could trigger by typing a victim's email) with per-source buckets.

Revision ID: 20261113_0011
Revises: 20260701_0010
Create Date: 2026-11-13
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261113_0011"
down_revision = "20260701_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "login_throttle_buckets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        # Keyed hashes, so neither the typed email nor the IP is stored.
        sa.Column("email_digest", sa.String(length=64), nullable=False),
        sa.Column("source_digest", sa.String(length=64), nullable=False),
        sa.Column("scope", sa.String(length=16), nullable=False),
        sa.Column("failures", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_failure_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lock_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_login_throttle_buckets"),
        sa.UniqueConstraint(
            "email_digest", "source_digest", name="uq_login_throttle_buckets_key"
        ),
        sa.CheckConstraint(
            "scope IN ('device', 'ip', 'untrusted')",
            name="ck_login_throttle_buckets_scope",
        ),
        sa.CheckConstraint(
            "failures >= 0 AND lock_count >= 0",
            name="ck_login_throttle_buckets_counts_nonnegative",
        ),
    )
    op.create_index(
        "ix_login_throttle_buckets_last_failure_at",
        "login_throttle_buckets",
        ["last_failure_at"],
    )

    op.drop_constraint("ck_users_failed_login_attempts_nonnegative", "users")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_attempts")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "failed_login_attempts",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_check_constraint(
        "ck_users_failed_login_attempts_nonnegative",
        "users",
        "failed_login_attempts >= 0",
    )
    op.drop_index(
        "ix_login_throttle_buckets_last_failure_at", table_name="login_throttle_buckets"
    )
    op.drop_table("login_throttle_buckets")
