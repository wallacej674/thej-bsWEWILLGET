"""Track verification email abuse across workers.

Revision ID: 20261113_sec11
Revises: 20261113_sec23
"""

import sqlalchemy as sa

from alembic import op

revision = "20261113_sec11"
down_revision = "20261113_sec23"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "verification_email_buckets",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("hour", sa.DateTime(timezone=True), primary_key=True),
        sa.Column("used", sa.Integer(), nullable=False),
    )
    op.create_index(
        "ix_verification_email_buckets_hour", "verification_email_buckets", ["hour"]
    )


def downgrade() -> None:
    op.drop_table("verification_email_buckets")
