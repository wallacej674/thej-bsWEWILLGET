from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.membership import WorkspaceMembership
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
            )
        )
        return session.execute(statement).tuples().one_or_none()
