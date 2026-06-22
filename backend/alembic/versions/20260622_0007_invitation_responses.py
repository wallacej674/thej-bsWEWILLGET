"""Add explicit workspace invitation responses.

Revision ID: 20260622_0007
Revises: 20260621_0006
Create Date: 2026-06-22
"""

import sqlalchemy as sa

from alembic import op

revision = "20260622_0007"
down_revision = "20260621_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workspace_invitations",
        sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_workspace_invitations_single_response",
        "workspace_invitations",
        "accepted_at IS NULL OR declined_at IS NULL",
    )
    op.create_index(
        "ix_workspace_invitations_email_pending",
        "workspace_invitations",
        ["email", "accepted_at", "declined_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_workspace_invitations_email_pending",
        table_name="workspace_invitations",
    )
    op.drop_constraint(
        "ck_workspace_invitations_single_response",
        "workspace_invitations",
    )
    op.drop_column("workspace_invitations", "declined_at")
