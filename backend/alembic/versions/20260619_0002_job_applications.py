"""Create job applications table.

Revision ID: 20260619_0002
Revises: 20260619_0001
Create Date: 2026-06-19
"""

import sqlalchemy as sa

from alembic import op

revision = "20260619_0002"
down_revision = "20260619_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_applications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("company_name", sa.String(length=200), nullable=False),
        sa.Column("job_title", sa.String(length=200), nullable=False),
        sa.Column("job_posting_url", sa.String(length=2048), nullable=False),
        sa.Column("normalized_job_posting_url", sa.String(length=2048), nullable=False),
        sa.Column("location", sa.String(length=200), nullable=False),
        sa.Column("work_arrangement", sa.String(length=20), nullable=False),
        sa.Column("employment_type", sa.String(length=20), nullable=False),
        sa.Column("application_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("salary_min", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("salary_max", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("salary_currency", sa.String(length=3), nullable=True),
        sa.Column("salary_period", sa.String(length=20), nullable=True),
        sa.Column("job_description", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('applied', 'rejected', 'withdrawn', 'closed')",
            name="ck_application_status",
        ),
        sa.CheckConstraint(
            "work_arrangement IN ('remote', 'hybrid', 'onsite', 'unknown')",
            name="ck_application_work_arrangement",
        ),
        sa.CheckConstraint(
            "employment_type IN ('full_time', 'part_time', 'contract', 'internship', 'temporary', 'unknown')",
            name="ck_application_employment_type",
        ),
        sa.CheckConstraint(
            "salary_period IS NULL OR salary_period IN ('hourly', 'monthly', 'yearly')",
            name="ck_application_salary_period",
        ),
        sa.CheckConstraint(
            "salary_min IS NULL OR salary_min >= 0", name="ck_application_salary_min"
        ),
        sa.CheckConstraint(
            "salary_max IS NULL OR salary_max >= 0", name="ck_application_salary_max"
        ),
        sa.CheckConstraint(
            "salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max",
            name="ck_application_salary_range",
        ),
        sa.CheckConstraint(
            "(salary_min IS NULL AND salary_max IS NULL) OR salary_period IS NOT NULL",
            name="ck_application_salary_period_required",
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["workspaces.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workspace_id",
            "owner_id",
            "normalized_job_posting_url",
            name="uq_application_workspace_owner_normalized_url",
        ),
    )
    op.create_index(
        "ix_applications_active_workspace_date",
        "job_applications",
        ["workspace_id", "deleted_at", "application_date"],
    )
    op.create_index(
        "ix_applications_workspace_owner_deleted",
        "job_applications",
        ["workspace_id", "owner_id", "deleted_at"],
    )
    op.create_index(
        "ix_applications_workspace_status_deleted",
        "job_applications",
        ["workspace_id", "status", "deleted_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_applications_workspace_status_deleted", "job_applications")
    op.drop_index("ix_applications_workspace_owner_deleted", "job_applications")
    op.drop_index("ix_applications_active_workspace_date", "job_applications")
    op.drop_table("job_applications")
