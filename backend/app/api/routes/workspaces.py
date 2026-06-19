from uuid import UUID

from fastapi import APIRouter

from app.api.dependencies.current_user import CurrentUser, DatabaseSession
from app.schemas.workspace import WorkspaceListResponse, WorkspaceSummary
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/workspaces", tags=["workspaces"])
workspace_service = WorkspaceService()


@router.get("", response_model=WorkspaceListResponse)
def list_workspaces(
    current_user: CurrentUser, session: DatabaseSession
) -> WorkspaceListResponse:
    return workspace_service.list_accessible_workspaces(session, current_user.id)


@router.get("/{workspace_id}", response_model=WorkspaceSummary)
def get_workspace(
    workspace_id: UUID, current_user: CurrentUser, session: DatabaseSession
) -> WorkspaceSummary:
    return workspace_service.get_accessible_workspace(
        session, workspace_id, current_user.id
    )
