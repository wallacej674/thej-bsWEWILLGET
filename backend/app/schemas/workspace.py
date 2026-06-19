from uuid import UUID

from pydantic import BaseModel

from app.core.enums import MembershipRole


class WorkspaceSummary(BaseModel):
    id: UUID
    name: str
    role: MembershipRole


class WorkspaceListResponse(BaseModel):
    items: list[WorkspaceSummary]
