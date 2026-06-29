from uuid import UUID

from sqlalchemy import Select, func, or_, select
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
        self,
        session: Session,
        workspace_id: UUID,
        *,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[tuple[WorkspaceMembership, User]], int]:
        filters = [
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.removed_at.is_(None),
        ]
        if search:
            pattern = f"%{search}%"
            filters.append(
                or_(User.display_name.ilike(pattern), User.email.ilike(pattern))
            )
        statement: Select[tuple[WorkspaceMembership, User]] = (
            select(WorkspaceMembership, User)
            .join(User, User.id == WorkspaceMembership.user_id)
            .where(*filters)
            .order_by(User.display_name, User.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        total = session.scalar(
            select(func.count())
            .select_from(WorkspaceMembership)
            .join(User, User.id == WorkspaceMembership.user_id)
            .where(*filters)
        )
        return list(session.execute(statement).tuples()), int(total or 0)

    def count_active_members(self, session: Session, workspace_id: UUID) -> int:
        total = session.scalar(
            select(func.count())
            .select_from(WorkspaceMembership)
            .where(
                WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.removed_at.is_(None),
            )
        )
        return int(total or 0)

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
        self,
        session: Session,
        workspace_id: UUID,
        *,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[WorkspaceInvitation], int]:
        filters = [
            WorkspaceInvitation.workspace_id == workspace_id,
            WorkspaceInvitation.accepted_at.is_(None),
            WorkspaceInvitation.declined_at.is_(None),
        ]
        if search:
            filters.append(WorkspaceInvitation.email.ilike(f"%{search}%"))
        statement = (
            select(WorkspaceInvitation)
            .where(*filters)
            .order_by(WorkspaceInvitation.created_at, WorkspaceInvitation.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        total = session.scalar(
            select(func.count()).select_from(WorkspaceInvitation).where(*filters)
        )
        return list(session.scalars(statement)), int(total or 0)

    def list_inbox_invitations(
        self, session: Session, email: str
    ) -> list[tuple[WorkspaceInvitation, Workspace, User]]:
        statement: Select[tuple[WorkspaceInvitation, Workspace, User]] = (
            select(WorkspaceInvitation, Workspace, User)
            .join(Workspace, Workspace.id == WorkspaceInvitation.workspace_id)
            .join(User, User.id == WorkspaceInvitation.invited_by_user_id)
            .where(
                WorkspaceInvitation.email == email,
                WorkspaceInvitation.accepted_at.is_(None),
                WorkspaceInvitation.declined_at.is_(None),
                Workspace.deleted_at.is_(None),
            )
            .order_by(
                WorkspaceInvitation.created_at.desc(),
                WorkspaceInvitation.id.desc(),
            )
        )
        return list(session.execute(statement).tuples())

    def get_pending_invitation_for_email(
        self, session: Session, invitation_id: UUID, email: str
    ) -> WorkspaceInvitation | None:
        return session.scalar(
            select(WorkspaceInvitation)
            .where(
                WorkspaceInvitation.id == invitation_id,
                WorkspaceInvitation.email == email,
                WorkspaceInvitation.accepted_at.is_(None),
                WorkspaceInvitation.declined_at.is_(None),
            )
            .with_for_update()
        )

    def get_pending_invitation(
        self, session: Session, workspace_id: UUID, invitation_id: UUID
    ) -> WorkspaceInvitation | None:
        return session.scalar(
            select(WorkspaceInvitation)
            .where(
                WorkspaceInvitation.id == invitation_id,
                WorkspaceInvitation.workspace_id == workspace_id,
                WorkspaceInvitation.accepted_at.is_(None),
                WorkspaceInvitation.declined_at.is_(None),
            )
            .with_for_update()
        )
