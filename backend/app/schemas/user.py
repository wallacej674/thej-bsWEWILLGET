from uuid import UUID

from pydantic import BaseModel

from app.models.user import User


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
