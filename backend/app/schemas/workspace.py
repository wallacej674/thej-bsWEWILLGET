from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.core.enums import MembershipRole


class WorkspaceSummary(BaseModel):
    id: UUID
    name: str
    role: MembershipRole


class WorkspaceListResponse(BaseModel):
    items: list[WorkspaceSummary]


class WorkspaceMemberUser(BaseModel):
    id: UUID
    display_name: str
    email: str
    avatar_url: str | None


class WorkspaceMember(BaseModel):
    user: WorkspaceMemberUser
    role: MembershipRole
    joined_at: datetime


class Pagination(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        return value.strip()


class WorkspaceMemberListResponse(BaseModel):
    items: list[WorkspaceMember]
    pagination: Pagination
    # Total active members in the workspace, independent of the current search
    # filter — used for the cap and the "N members" header.
    member_count: int


class WorkspaceMemberRoleUpdate(BaseModel):
    role: Literal[MembershipRole.ADMIN, MembershipRole.MEMBER]


class WorkspaceInvitationCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if (
            "@" not in normalized
            or normalized.startswith("@")
            or normalized.endswith("@")
        ):
            raise ValueError("Enter a valid email address")
        return normalized


class WorkspaceInvitationResponse(BaseModel):
    id: UUID
    email: str
    role: Literal["member"] = "member"
    status: Literal["pending"]
    invited_at: datetime


class WorkspaceInvitationListResponse(BaseModel):
    items: list[WorkspaceInvitationResponse]
    pagination: Pagination


class InvitationWorkspace(BaseModel):
    id: UUID
    name: str


class InvitationSender(BaseModel):
    display_name: str


class InvitationInboxItem(BaseModel):
    id: UUID
    workspace: InvitationWorkspace
    invited_by: InvitationSender
    invited_at: datetime


class InvitationInboxResponse(BaseModel):
    items: list[InvitationInboxItem]
