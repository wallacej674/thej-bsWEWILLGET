"""Join the login-throttling and odd security migration histories.

Revision ID: 20261113_merge_odd
Revises: 20261113_0011, 20261113_sec13
"""

revision = "20261113_merge_odd"
down_revision = ("20261113_0011", "20261113_sec13")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
