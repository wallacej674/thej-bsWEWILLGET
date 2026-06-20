from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.invitation import WorkspaceInvitation
from app.models.membership import WorkspaceMembership
from app.models.user import User
from app.models.workspace import Workspace


class WorkspaceRepository:
    def list_active_for_user(
        self, session: Session, user_id: UUID
    ) -> list[tuple[Workspace, WorkspaceMembership]]:
        statement: Select[tuple[Workspace, WorkspaceMembership]] = (
            select(Workspace, WorkspaceMembership)
            .join(
                WorkspaceMembership,
                WorkspaceMembership.workspace_id == Workspace.id,
            )
            .where(
                WorkspaceMembership.user_id == user_id,
                WorkspaceMembership.removed_at.is_(None),
                Workspace.deleted_at.is_(None),
            )
            .order_by(Workspace.name)
        )
        return list(session.execute(statement).tuples())

    def get_active_for_user(
        self, session: Session, workspace_id: UUID, user_id: UUID
    ) -> tuple[Workspace, WorkspaceMembership] | None:
        statement = (
            select(Workspace, WorkspaceMembership)
            .join(
                WorkspaceMembership,
                WorkspaceMembership.workspace_id == Workspace.id,
            )
            .where(
                Workspace.id == workspace_id,
                WorkspaceMembership.user_id == user_id,
                WorkspaceMembership.removed_at.is_(None),
                Workspace.deleted_at.is_(None),
            )
        )
        return session.execute(statement).tuples().one_or_none()

    def list_active_members(
        self, session: Session, workspace_id: UUID
    ) -> list[tuple[WorkspaceMembership, User]]:
        statement: Select[tuple[WorkspaceMembership, User]] = (
            select(WorkspaceMembership, User)
            .join(User, User.id == WorkspaceMembership.user_id)
            .where(
                WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.removed_at.is_(None),
            )
            .order_by(User.display_name, User.id)
        )
        return list(session.execute(statement).tuples())

    def get_active_membership(
        self, session: Session, workspace_id: UUID, user_id: UUID
    ) -> WorkspaceMembership | None:
        return session.scalar(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.user_id == user_id,
                WorkspaceMembership.removed_at.is_(None),
            )
        )

    def get_workspace(self, session: Session, workspace_id: UUID) -> Workspace | None:
        return session.scalar(
            select(Workspace).where(
                Workspace.id == workspace_id,
                Workspace.deleted_at.is_(None),
            )
        )

    def get_user_by_email(self, session: Session, email: str) -> User | None:
        return session.scalar(select(User).where(User.email == email))

    def get_invitation(
        self, session: Session, workspace_id: UUID, email: str
    ) -> WorkspaceInvitation | None:
        return session.scalar(
            select(WorkspaceInvitation).where(
                WorkspaceInvitation.workspace_id == workspace_id,
                WorkspaceInvitation.email == email,
            )
        )

    def list_pending_invitations(
        self, session: Session, workspace_id: UUID
    ) -> list[WorkspaceInvitation]:
        return list(
            session.scalars(
                select(WorkspaceInvitation)
                .where(
                    WorkspaceInvitation.workspace_id == workspace_id,
                    WorkspaceInvitation.accepted_at.is_(None),
                )
                .order_by(WorkspaceInvitation.created_at, WorkspaceInvitation.id)
            )
        )

    def list_pending_invitations_for_email(
        self, session: Session, email: str
    ) -> list[WorkspaceInvitation]:
        return list(
            session.scalars(
                select(WorkspaceInvitation).where(
                    WorkspaceInvitation.email == email,
                    WorkspaceInvitation.accepted_at.is_(None),
                )
            )
        )
