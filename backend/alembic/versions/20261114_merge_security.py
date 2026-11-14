"""Join the odd and even security migration histories.

Revision ID: 20261114_merge_security
Revises: 20261113_merge_odd, 20261114_0013
"""

revision = "20261114_merge_security"
down_revision = ("20261113_merge_odd", "20261114_0013")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
