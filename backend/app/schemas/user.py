from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.user import User


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=1024)


class AccountExport(BaseModel):
    id: UUID
    email: str
    display_name: str
    applications: list[dict[str, Any]]
    resume: dict[str, Any] | None
    analyses: list[dict[str, Any]]


class CurrentUserResponse(BaseModel):
    id: UUID
    display_name: str
    avatar_url: str | None

    @classmethod
    def from_user(cls, user: User) -> "CurrentUserResponse":
        return cls(
            id=user.id,
            display_name=user.display_name,
            avatar_url=user.avatar_url,
        )
