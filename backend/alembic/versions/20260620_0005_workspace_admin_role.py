"""Add workspace admin role.

Revision ID: 20260620_0005
Revises: 20260619_0004
Create Date: 2026-06-20
"""


from alembic import op

revision = "20260620_0005"
down_revision = "20260619_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_membership_role",
        "workspace_memberships",
        type_="check",
    )
    op.create_check_constraint(
        "ck_membership_role",
        "workspace_memberships",
        "role IN ('owner', 'admin', 'member')",
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE workspace_memberships
        SET role = 'member'
        WHERE role = 'admin'
        """
    )
    op.drop_constraint(
        "ck_membership_role",
        "workspace_memberships",
        type_="check",
    )
    op.create_check_constraint(
        "ck_membership_role",
        "workspace_memberships",
        "role IN ('owner', 'member')",
    )
