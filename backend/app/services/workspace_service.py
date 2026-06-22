from typing import Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import MembershipRole
from app.core.errors import AppError
from app.core.time import utc_now
from app.models.invitation import WorkspaceInvitation
from app.models.membership import WorkspaceMembership
from app.models.user import User
from app.models.workspace import Workspace
from app.repositories.workspace_repository import WorkspaceRepository
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceInvitationCreate,
    WorkspaceInvitationListResponse,
    WorkspaceInvitationResponse,
    WorkspaceListResponse,
    WorkspaceMember,
    WorkspaceMemberListResponse,
    WorkspaceMemberRoleUpdate,
    WorkspaceMemberUser,
    WorkspaceSummary,
)


class WorkspaceService:
    def __init__(self, repository: WorkspaceRepository | None = None) -> None:
        self._repository = repository or WorkspaceRepository()

    def list_accessible_workspaces(
        self, session: Session, user_id: UUID
    ) -> WorkspaceListResponse:
        user = session.get(User, user_id)
        if user is not None and self.claim_pending_invitations(session, user):
            session.commit()
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

    def claim_pending_invitations(self, session: Session, user: User) -> int:
        pending_invitations = self._repository.list_pending_invitations_for_email(
            session, user.email
        )
        for invitation in pending_invitations:
            membership = session.scalar(
                select(WorkspaceMembership).where(
                    WorkspaceMembership.workspace_id == invitation.workspace_id,
                    WorkspaceMembership.user_id == user.id,
                )
            )
            if membership is None:
                session.add(
                    WorkspaceMembership(
                        workspace_id=invitation.workspace_id,
                        user_id=user.id,
                        role=MembershipRole.MEMBER,
                    )
                )
            else:
                membership.role = MembershipRole.MEMBER
                membership.removed_at = None
                membership.updated_at = utc_now()
            invitation.accepted_at = utc_now()
        return len(pending_invitations)

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

    def create_workspace(
        self, session: Session, owner_id: UUID, payload: WorkspaceCreate
    ) -> WorkspaceSummary:
        workspace = Workspace(name=payload.name)
        session.add(workspace)
        session.flush()
        membership = WorkspaceMembership(
            workspace_id=workspace.id,
            user_id=owner_id,
            role=MembershipRole.OWNER,
        )
        session.add(membership)
        session.commit()
        session.refresh(workspace)
        return WorkspaceSummary(
            id=workspace.id,
            name=workspace.name,
            role=MembershipRole.OWNER,
        )

    def list_members(
        self, session: Session, workspace_id: UUID
    ) -> WorkspaceMemberListResponse:
        return WorkspaceMemberListResponse(
            items=[
                WorkspaceMember(
                    user=WorkspaceMemberUser(
                        id=user.id,
                        display_name=user.display_name,
                        email=user.email,
                        avatar_url=user.avatar_url,
                    ),
                    role=membership.role,
                    joined_at=membership.created_at,
                )
                for membership, user in self._repository.list_active_members(
                    session, workspace_id
                )
            ]
        )

    def invite_member(
        self,
        session: Session,
        workspace_id: UUID,
        actor_membership: WorkspaceMembership,
        invited_by_user_id: UUID,
        payload: WorkspaceInvitationCreate,
    ) -> WorkspaceInvitationResponse:
        self._require_owner(actor_membership)
        existing_invitation = self._repository.get_invitation(
            session, workspace_id, payload.email
        )
        if existing_invitation is not None:
            raise AppError(
                409,
                "workspace_invitation_exists",
                "This email has already been invited.",
            )
        user = self._repository.get_user_by_email(session, payload.email)
        if user is not None:
            existing_membership = self._repository.get_active_membership(
                session, workspace_id, user.id
            )
            if existing_membership is not None:
                raise AppError(
                    409,
                    "workspace_member_exists",
                    "This user is already a workspace member.",
                )
        invitation = WorkspaceInvitation(
            workspace_id=workspace_id,
            email=payload.email,
            invited_by_user_id=invited_by_user_id,
        )
        session.add(invitation)
        session.flush()
        invitation_status: Literal["pending", "joined"] = "pending"
        if user is not None:
            membership = session.scalar(
                select(WorkspaceMembership).where(
                    WorkspaceMembership.workspace_id == workspace_id,
                    WorkspaceMembership.user_id == user.id,
                )
            )
            if membership is None:
                membership = WorkspaceMembership(
                    workspace_id=workspace_id,
                    user_id=user.id,
                    role=MembershipRole.MEMBER,
                )
                session.add(membership)
            else:
                membership.role = MembershipRole.MEMBER
                membership.removed_at = None
                membership.updated_at = utc_now()
            invitation.accepted_at = utc_now()
            invitation_status = "joined"
        session.commit()
        session.refresh(invitation)
        return WorkspaceInvitationResponse(
            id=invitation.id,
            email=invitation.email,
            status=invitation_status,
            invited_at=invitation.created_at,
        )

    def list_pending_invitations(
        self,
        session: Session,
        workspace_id: UUID,
        actor_membership: WorkspaceMembership,
    ) -> WorkspaceInvitationListResponse:
        self._require_owner(actor_membership)
        return WorkspaceInvitationListResponse(
            items=[
                WorkspaceInvitationResponse(
                    id=invitation.id,
                    email=invitation.email,
                    status="pending",
                    invited_at=invitation.created_at,
                )
                for invitation in self._repository.list_pending_invitations(
                    session, workspace_id
                )
            ]
        )

    def remove_member(
        self,
        session: Session,
        workspace_id: UUID,
        actor_membership: WorkspaceMembership,
        user_id: UUID,
    ) -> None:
        self._require_owner(actor_membership)
        membership = self._repository.get_active_membership(
            session, workspace_id, user_id
        )
        if membership is None:
            raise AppError(404, "workspace_member_not_found", "Member was not found.")
        if membership.role == MembershipRole.OWNER:
            raise AppError(
                409,
                "workspace_owner_removal_not_supported",
                "Workspace owners cannot be removed from this screen.",
            )
        membership.removed_at = utc_now()
        membership.updated_at = utc_now()
        session.commit()

    def update_member_role(
        self,
        session: Session,
        workspace_id: UUID,
        actor_membership: WorkspaceMembership,
        user_id: UUID,
        payload: WorkspaceMemberRoleUpdate,
    ) -> WorkspaceMember:
        self._require_owner(actor_membership)
        membership = self._repository.get_active_membership(
            session, workspace_id, user_id
        )
        if membership is None:
            raise AppError(404, "workspace_member_not_found", "Member was not found.")
        if membership.role == MembershipRole.OWNER:
            raise AppError(
                409,
                "workspace_owner_role_change_not_supported",
                "Workspace owner roles cannot be changed from this screen.",
            )
        user = session.get(User, user_id)
        if user is None:
            raise AppError(404, "workspace_member_not_found", "Member was not found.")
        membership.role = payload.role
        membership.updated_at = utc_now()
        session.commit()
        return WorkspaceMember(
            user=WorkspaceMemberUser(
                id=user.id,
                display_name=user.display_name,
                email=user.email,
                avatar_url=user.avatar_url,
            ),
            role=membership.role,
            joined_at=membership.created_at,
        )

    def delete_workspace(
        self,
        session: Session,
        workspace_id: UUID,
        actor_membership: WorkspaceMembership,
    ) -> None:
        self._require_owner(actor_membership)
        workspace = self._repository.get_workspace(session, workspace_id)
        if workspace is None:
            raise AppError(404, "workspace_not_found", "Workspace was not found.")
        workspace.deleted_at = utc_now()
        workspace.updated_at = utc_now()
        session.commit()

    def _require_owner(self, membership: WorkspaceMembership) -> None:
        if membership.role != MembershipRole.OWNER:
            raise AppError(
                403,
                "workspace_owner_required",
                "Workspace owner access is required.",
            )
