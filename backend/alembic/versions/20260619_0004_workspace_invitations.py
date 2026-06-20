"""Add workspace invitations.

Revision ID: 20260619_0004
Revises: 20260619_0003
Create Date: 2026-06-19
"""

import sqlalchemy as sa

from alembic import op

revision = "20260619_0004"
down_revision = "20260619_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workspace_invitations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("invited_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["invited_by_user_id"], ["users.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["workspaces.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workspace_id",
            "email",
            name="uq_workspace_invitation_workspace_email",
        ),
    )
    op.create_index(
        "ix_workspace_invitations_pending",
        "workspace_invitations",
        ["workspace_id", "accepted_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_workspace_invitations_pending",
        table_name="workspace_invitations",
    )
    op.drop_table("workspace_invitations")
