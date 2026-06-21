"""Add workspace administration and deletion attribution.

Revision ID: 20260619_0003
Revises: 20260619_0002
Create Date: 2026-06-19
"""

import sqlalchemy as sa

from alembic import op

revision = "20260619_0003"
down_revision = "20260619_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workspaces",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "job_applications",
        sa.Column("deleted_by_user_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_job_applications_deleted_by_user_id_users",
        "job_applications",
        "users",
        ["deleted_by_user_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_workspaces_deleted_at", "workspaces", ["deleted_at"])
    op.create_index(
        "ix_applications_workspace_deleted_by",
        "job_applications",
        ["workspace_id", "deleted_by_user_id", "deleted_at"],
    )
    op.execute(
        """
        UPDATE job_applications
        SET deleted_by_user_id = owner_id
        WHERE deleted_at IS NOT NULL AND deleted_by_user_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_applications_workspace_deleted_by",
        table_name="job_applications",
    )
    op.drop_index("ix_workspaces_deleted_at", table_name="workspaces")
    op.drop_constraint(
        "fk_job_applications_deleted_by_user_id_users",
        "job_applications",
        type_="foreignkey",
    )
    op.drop_column("job_applications", "deleted_by_user_id")
    op.drop_column("workspaces", "deleted_at")
