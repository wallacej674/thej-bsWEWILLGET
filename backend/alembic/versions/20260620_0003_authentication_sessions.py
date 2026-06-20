"""Add local-password and revocable authentication-session state.

Revision ID: 20260620_0003
Revises: 20260619_0002
Create Date: 2026-06-20
"""

import sqlalchemy as sa

from alembic import op

revision = "20260620_0003"
down_revision = "20260619_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("password_hash", sa.String(length=512), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column(
            "failed_login_attempts",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_users_failed_login_attempts_nonnegative",
        "users",
        "failed_login_attempts >= 0",
    )
    op.create_table(
        "authentication_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("refresh_jti_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_refreshed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "refresh_jti_hash", name="uq_auth_sessions_refresh_jti_hash"
        ),
    )
    op.create_index(
        "ix_auth_sessions_user_revoked",
        "authentication_sessions",
        ["user_id", "revoked_at"],
    )
    op.create_index(
        "ix_auth_sessions_expires_at", "authentication_sessions", ["expires_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_auth_sessions_expires_at", table_name="authentication_sessions")
    op.drop_index("ix_auth_sessions_user_revoked", table_name="authentication_sessions")
    op.drop_table("authentication_sessions")
    op.drop_constraint("ck_users_failed_login_attempts_nonnegative", "users")
    op.drop_column("users", "password_changed_at")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_attempts")
    op.drop_column("users", "password_hash")
