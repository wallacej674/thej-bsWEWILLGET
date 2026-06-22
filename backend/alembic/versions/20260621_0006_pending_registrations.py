"""Add pending email registrations.

Revision ID: 20260621_0006
Revises: a40908e3b1e6
Create Date: 2026-06-21
"""

import sqlalchemy as sa

from alembic import op

revision = "20260621_0006"
down_revision = "a40908e3b1e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pending_registrations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("workspace_name", sa.String(length=200), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_pending_registrations_email"),
        sa.UniqueConstraint(
            "token_digest", name="uq_pending_registrations_token_digest"
        ),
    )
    op.create_index(
        "ix_pending_registrations_expires_at",
        "pending_registrations",
        ["expires_at"],
    )
    op.create_index(
        "ix_pending_registrations_token_consumed",
        "pending_registrations",
        ["token_digest", "consumed_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_pending_registrations_token_consumed",
        table_name="pending_registrations",
    )
    op.drop_index(
        "ix_pending_registrations_expires_at",
        table_name="pending_registrations",
    )
    op.drop_table("pending_registrations")
