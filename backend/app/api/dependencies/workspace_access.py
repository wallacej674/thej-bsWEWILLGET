from typing import Annotated
from uuid import UUID

from fastapi import Depends, Path
from sqlalchemy import select

from app.api.dependencies.current_user import CurrentUser, DatabaseSession
from app.core.errors import AppError
from app.models.membership import WorkspaceMembership
from app.models.workspace import Workspace


def require_active_workspace_membership(
    workspace_id: Annotated[UUID, Path()],
    current_user: CurrentUser,
    session: DatabaseSession,
) -> WorkspaceMembership:
    workspace = session.get(Workspace, workspace_id)
    if workspace is None:
        raise AppError(404, "workspace_not_found", "Workspace was not found.")
    membership = session.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == current_user.id,
            WorkspaceMembership.removed_at.is_(None),
        )
    )
    if membership is None:
        raise AppError(
            403,
            "workspace_access_denied",
            "You do not have access to this workspace.",
        )
    return membership


WorkspaceAccess = Annotated[
    WorkspaceMembership, Depends(require_active_workspace_membership)
]
