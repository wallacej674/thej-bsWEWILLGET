from uuid import UUID

from fastapi import APIRouter, Response, status

from app.api.dependencies.current_user import CurrentUser, DatabaseSession
from app.api.dependencies.workspace_access import WorkspaceAccess
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceInvitationCreate,
    WorkspaceInvitationListResponse,
    WorkspaceInvitationResponse,
    WorkspaceListResponse,
    WorkspaceMember,
    WorkspaceMemberListResponse,
    WorkspaceMemberRoleUpdate,
    WorkspaceSummary,
)
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/workspaces", tags=["workspaces"])
workspace_service = WorkspaceService()


@router.post("", response_model=WorkspaceSummary, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreate,
    current_user: CurrentUser,
    session: DatabaseSession,
) -> WorkspaceSummary:
    return workspace_service.create_workspace(session, current_user.id, payload)


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


@router.get("/{workspace_id}/members", response_model=WorkspaceMemberListResponse)
def list_workspace_members(
    workspace_id: UUID,
    _membership: WorkspaceAccess,
    session: DatabaseSession,
) -> WorkspaceMemberListResponse:
    return workspace_service.list_members(session, workspace_id)


@router.patch(
    "/{workspace_id}/members/{user_id}/role",
    response_model=WorkspaceMember,
)
def update_workspace_member_role(
    workspace_id: UUID,
    user_id: UUID,
    payload: WorkspaceMemberRoleUpdate,
    membership: WorkspaceAccess,
    session: DatabaseSession,
) -> WorkspaceMember:
    return workspace_service.update_member_role(
        session, workspace_id, membership, user_id, payload
    )


@router.post(
    "/{workspace_id}/invitations",
    response_model=WorkspaceInvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
def invite_workspace_member(
    workspace_id: UUID,
    payload: WorkspaceInvitationCreate,
    current_user: CurrentUser,
    membership: WorkspaceAccess,
    session: DatabaseSession,
) -> WorkspaceInvitationResponse:
    return workspace_service.invite_member(
        session,
        workspace_id,
        membership,
        current_user.id,
        payload,
    )


@router.get(
    "/{workspace_id}/invitations",
    response_model=WorkspaceInvitationListResponse,
)
def list_workspace_invitations(
    workspace_id: UUID,
    membership: WorkspaceAccess,
    session: DatabaseSession,
) -> WorkspaceInvitationListResponse:
    return workspace_service.list_pending_invitations(session, workspace_id, membership)


@router.delete(
    "/{workspace_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_workspace_member(
    workspace_id: UUID,
    user_id: UUID,
    membership: WorkspaceAccess,
    session: DatabaseSession,
) -> Response:
    workspace_service.remove_member(session, workspace_id, membership, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(
    workspace_id: UUID,
    membership: WorkspaceAccess,
    session: DatabaseSession,
) -> Response:
    workspace_service.delete_workspace(session, workspace_id, membership)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
