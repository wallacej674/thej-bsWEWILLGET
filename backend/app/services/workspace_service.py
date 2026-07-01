from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import MembershipRole
from app.core.errors import AppError
from app.core.settings import get_settings
from app.core.time import utc_now
from app.models.invitation import WorkspaceInvitation
from app.models.membership import WorkspaceMembership
from app.models.user import User
from app.models.workspace import Workspace
from app.repositories.workspace_repository import WorkspaceRepository
from app.schemas.workspace import (
    InvitationInboxItem,
    InvitationInboxResponse,
    InvitationSender,
    InvitationWorkspace,
    Pagination,
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


def _pagination(page: int, page_size: int, total: int) -> Pagination:
    return Pagination(
        page=page,
        page_size=page_size,
        total_items=total,
        total_pages=(total + page_size - 1) // page_size if total else 0,
    )


class WorkspaceService:
    def __init__(self, repository: WorkspaceRepository | None = None) -> None:
        self._repository = repository or WorkspaceRepository()

    def _enforce_member_cap(self, session: Session, workspace_id: UUID) -> None:
        cap = get_settings().workspace_member_cap
        if self._repository.count_active_members(session, workspace_id) >= cap:
            raise AppError(
                409,
                "workspace_member_cap_reached",
                f"This workspace has reached its limit of {cap} members.",
            )

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
        self,
        session: Session,
        workspace_id: UUID,
        *,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> WorkspaceMemberListResponse:
        rows, total = self._repository.list_active_members(
            session, workspace_id, search=search, page=page, page_size=page_size
        )
        member_count = (
            total
            if not search
            else self._repository.count_active_members(session, workspace_id)
        )
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
                for membership, user in rows
            ],
            pagination=_pagination(page, page_size, total),
            member_count=member_count,
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
        self._enforce_member_cap(session, workspace_id)
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
        existing_invitation = self._repository.get_invitation(
            session, workspace_id, payload.email
        )
        if (
            existing_invitation is not None
            and existing_invitation.accepted_at is None
            and existing_invitation.declined_at is None
        ):
            raise AppError(
                409,
                "workspace_invitation_exists",
                "This email already has a pending invitation.",
            )
        if existing_invitation is None:
            invitation = WorkspaceInvitation(
                workspace_id=workspace_id,
                email=payload.email,
                invited_by_user_id=invited_by_user_id,
            )
            session.add(invitation)
        else:
            invitation = existing_invitation
            invitation.invited_by_user_id = invited_by_user_id
            invitation.accepted_at = None
            invitation.declined_at = None
            invitation.created_at = utc_now()
        session.flush()
        session.commit()
        session.refresh(invitation)
        return WorkspaceInvitationResponse(
            id=invitation.id,
            email=invitation.email,
            status="pending",
            invited_at=invitation.created_at,
        )

    def list_invitation_inbox(
        self, session: Session, user: User
    ) -> InvitationInboxResponse:
        return InvitationInboxResponse(
            items=[
                InvitationInboxItem(
                    id=invitation.id,
                    workspace=InvitationWorkspace(
                        id=workspace.id,
                        name=workspace.name,
                    ),
                    invited_by=InvitationSender(
                        display_name=inviter.display_name,
                    ),
                    invited_at=invitation.created_at,
                )
                for invitation, workspace, inviter in (
                    self._repository.list_inbox_invitations(session, user.email)
                )
            ]
        )

    def accept_invitation(
        self, session: Session, invitation_id: UUID, user: User
    ) -> WorkspaceSummary:
        invitation = self._repository.get_pending_invitation_for_email(
            session, invitation_id, user.email
        )
        if invitation is None:
            raise AppError(
                404,
                "workspace_invitation_not_found",
                "Workspace invitation was not found.",
            )
        workspace = self._repository.get_workspace(session, invitation.workspace_id)
        if workspace is None:
            raise AppError(
                404,
                "workspace_invitation_not_found",
                "Workspace invitation was not found.",
            )
        membership = session.scalar(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == workspace.id,
                WorkspaceMembership.user_id == user.id,
            )
        )
        # Joining (new membership or re-activating a removed one) grows the active
        # roster, so it must respect the hard cap. An already-active membership is
        # idempotent and exempt.
        if membership is None or membership.removed_at is not None:
            self._enforce_member_cap(session, workspace.id)
        if membership is None:
            session.add(
                WorkspaceMembership(
                    workspace_id=workspace.id,
                    user_id=user.id,
                    role=MembershipRole.MEMBER,
                )
            )
        else:
            membership.role = MembershipRole.MEMBER
            membership.removed_at = None
            membership.updated_at = utc_now()
        invitation.accepted_at = utc_now()
        session.commit()
        return WorkspaceSummary(
            id=workspace.id,
            name=workspace.name,
            role=MembershipRole.MEMBER,
        )

    def decline_invitation(
        self, session: Session, invitation_id: UUID, user: User
    ) -> None:
        invitation = self._repository.get_pending_invitation_for_email(
            session, invitation_id, user.email
        )
        if invitation is None:
            raise AppError(
                404,
                "workspace_invitation_not_found",
                "Workspace invitation was not found.",
            )
        invitation.declined_at = utc_now()
        session.commit()

    def list_pending_invitations(
        self,
        session: Session,
        workspace_id: UUID,
        actor_membership: WorkspaceMembership,
        *,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> WorkspaceInvitationListResponse:
        self._require_owner(actor_membership)
        invitations, total = self._repository.list_pending_invitations(
            session, workspace_id, search=search, page=page, page_size=page_size
        )
        return WorkspaceInvitationListResponse(
            items=[
                WorkspaceInvitationResponse(
                    id=invitation.id,
                    email=invitation.email,
                    status="pending",
                    invited_at=invitation.created_at,
                )
                for invitation in invitations
            ],
            pagination=_pagination(page, page_size, total),
        )

    def revoke_invitation(
        self,
        session: Session,
        workspace_id: UUID,
        actor_membership: WorkspaceMembership,
        invitation_id: UUID,
    ) -> None:
        self._require_owner(actor_membership)
        invitation = self._repository.get_pending_invitation(
            session, workspace_id, invitation_id
        )
        if invitation is None:
            raise AppError(
                404,
                "workspace_invitation_not_found",
                "Workspace invitation was not found.",
            )
        session.delete(invitation)
        session.commit()

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
