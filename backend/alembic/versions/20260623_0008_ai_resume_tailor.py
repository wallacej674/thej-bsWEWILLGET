"""Add resume profiles and application AI analyses.

Revision ID: 20260623_0008
Revises: 20260622_0007
Create Date: 2026-06-23
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20260623_0008"
down_revision = "20260622_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_resumes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=False),
        sa.Column("parser_status", sa.String(length=40), nullable=False),
        sa.Column(
            "parser_warnings", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_resumes_user_id"),
    )
    op.create_index("ix_user_resumes_user_id", "user_resumes", ["user_id"])

    op.create_table(
        "application_ai_analyses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("prompt_version", sa.String(length=40), nullable=False),
        sa.Column("provider_name", sa.String(length=80), nullable=False),
        sa.Column("model_name", sa.String(length=120), nullable=False),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["application_id"], ["job_applications.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "application_id",
            "user_id",
            "prompt_version",
            name="uq_application_ai_analyses_application_user_prompt",
        ),
    )
    op.create_index(
        "ix_application_ai_analyses_application_user",
        "application_ai_analyses",
        ["application_id", "user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_application_ai_analyses_application_user",
        table_name="application_ai_analyses",
    )
    op.drop_table("application_ai_analyses")
    op.drop_index("ix_user_resumes_user_id", table_name="user_resumes")
    op.drop_table("user_resumes")
