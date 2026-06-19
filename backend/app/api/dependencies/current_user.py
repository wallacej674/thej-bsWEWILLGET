from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.settings import get_settings
from app.db.session import get_db
from app.models.user import User

DatabaseSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    session: DatabaseSession,
    user_id_header: Annotated[str | None, Header(alias="X-User-Id")] = None,
) -> User:
    settings = get_settings()
    if not settings.dev_identity_header_enabled:
        raise AppError(
            401,
            "development_identity_disabled",
            "Development identity is disabled.",
        )
    if user_id_header is None:
        raise AppError(
            401,
            "authentication_required",
            "X-User-Id is required.",
        )
    try:
        user_id = UUID(user_id_header)
    except ValueError as error:
        raise AppError(
            401,
            "authentication_required",
            "X-User-Id must be a UUID.",
        ) from error

    user = session.get(User, user_id)
    if user is None:
        raise AppError(401, "user_not_found", "The current user was not found.")
    if not user.is_active:
        raise AppError(401, "inactive_user", "The current user is inactive.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
