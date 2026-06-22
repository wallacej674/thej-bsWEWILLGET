from uuid import UUID

from fastapi import APIRouter, Response, status

from app.api.dependencies.current_user import CurrentUser, DatabaseSession
from app.schemas.workspace import InvitationInboxResponse, WorkspaceSummary
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/invitations", tags=["invitations"])
workspace_service = WorkspaceService()


@router.get("", response_model=InvitationInboxResponse)
def list_invitation_inbox(
    current_user: CurrentUser,
    session: DatabaseSession,
) -> InvitationInboxResponse:
    return workspace_service.list_invitation_inbox(session, current_user)


@router.post("/{invitation_id}/accept", response_model=WorkspaceSummary)
def accept_invitation(
    invitation_id: UUID,
    current_user: CurrentUser,
    session: DatabaseSession,
) -> WorkspaceSummary:
    return workspace_service.accept_invitation(session, invitation_id, current_user)


@router.post(
    "/{invitation_id}/decline",
    status_code=status.HTTP_204_NO_CONTENT,
)
def decline_invitation(
    invitation_id: UUID,
    current_user: CurrentUser,
    session: DatabaseSession,
) -> Response:
    workspace_service.decline_invitation(session, invitation_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
