from uuid import UUID

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.repositories.workspace_repository import WorkspaceRepository
from app.schemas.workspace import WorkspaceListResponse, WorkspaceSummary


class WorkspaceService:
    def __init__(self, repository: WorkspaceRepository | None = None) -> None:
        self._repository = repository or WorkspaceRepository()

    def list_accessible_workspaces(
        self, session: Session, user_id: UUID
    ) -> WorkspaceListResponse:
        memberships = self._repository.list_active_for_user(session, user_id)
        return WorkspaceListResponse(
            items=[
                WorkspaceSummary(
                    id=workspace.id,
                    name=workspace.name,
                    role=membership.role,
                )
                for workspace, membership in memberships
            ]
        )

    def get_accessible_workspace(
        self, session: Session, workspace_id: UUID, user_id: UUID
    ) -> WorkspaceSummary:
        membership = self._repository.get_active_for_user(
            session, workspace_id, user_id
        )
        if membership is None:
            raise AppError(404, "workspace_not_found", "Workspace was not found.")
        workspace, current_membership = membership
        return WorkspaceSummary(
            id=workspace.id,
            name=workspace.name,
            role=current_membership.role,
        )
