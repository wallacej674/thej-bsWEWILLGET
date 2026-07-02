"""Add composite indexes for large-workspace dashboard aggregates.

Revision ID: 20260625_0009
Revises: 20260623_0008
Create Date: 2026-06-25
"""

from alembic import op

revision = "20260625_0009"
down_revision = "20260623_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_job_applications_workspace_owner_status",
        "job_applications",
        ["workspace_id", "owner_id", "status"],
    )
    op.create_index(
        "ix_job_applications_workspace_application_date",
        "job_applications",
        ["workspace_id", "application_date"],
    )
    op.create_index(
        "ix_job_applications_workspace_updated_at",
        "job_applications",
        ["workspace_id", "updated_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_job_applications_workspace_updated_at",
        table_name="job_applications",
    )
    op.drop_index(
        "ix_job_applications_workspace_application_date",
        table_name="job_applications",
    )
    op.drop_index(
        "ix_job_applications_workspace_owner_status",
        table_name="job_applications",
    )
