from typing import Annotated
from uuid import UUID

from authx.exceptions import AuthXException, CSRFError, TokenExpiredError
from authx.schema import TokenPayload
from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from app.core.auth import get_authx
from app.core.errors import AppError
from app.core.settings import get_settings
from app.core.time import utc_now
from app.db.session import get_db
from app.models.auth_session import AuthenticationSession
from app.models.user import User

DatabaseSession = Annotated[Session, Depends(get_db)]
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _session_id(payload: TokenPayload) -> UUID:
    value = (payload.model_extra or {}).get("sid")
    if not isinstance(value, str):
        raise AppError(401, "invalid_access_token", "Authentication is required.")
    try:
        return UUID(value)
    except ValueError as error:
        raise AppError(
            401, "invalid_access_token", "Authentication is required."
        ) from error


async def _cookie_user(request: Request, session: Session) -> User:
    authx = get_authx()
    try:
        token = await authx.get_access_token_from_request(request)
        payload = authx.verify_token(
            token, verify_csrf=request.method in UNSAFE_METHODS
        )
    except CSRFError as error:
        raise AppError(
            403,
            "csrf_validation_failed",
            "The request could not be validated.",
        ) from error
    except TokenExpiredError as error:
        raise AppError(
            401, "expired_access_token", "Authentication is required."
        ) from error
    except AuthXException as error:
        raise AppError(
            401, "invalid_access_token", "Authentication is required."
        ) from error

    authentication_session = session.get(AuthenticationSession, _session_id(payload))
    if (
        authentication_session is None
        or authentication_session.revoked_at is not None
        or authentication_session.expires_at <= utc_now()
    ):
        raise AppError(401, "session_revoked", "Authentication is required.")
    try:
        user_id = UUID(payload.sub)
    except ValueError as error:
        raise AppError(
            401, "invalid_access_token", "Authentication is required."
        ) from error
    if authentication_session.user_id != user_id:
        raise AppError(401, "invalid_access_token", "Authentication is required.")

    user = session.get(User, user_id)
    if user is None or not user.is_active:
        raise AppError(401, "authentication_required", "Authentication is required.")
    return user


def _development_header_user(session: Session, user_id_header: str | None) -> User:
    settings = get_settings()
    if not settings.dev_identity_header_enabled or user_id_header is None:
        raise AppError(401, "authentication_required", "Authentication is required.")
    try:
        user_id = UUID(user_id_header)
    except ValueError as error:
        raise AppError(
            401, "authentication_required", "Authentication is required."
        ) from error

    user = session.get(User, user_id)
    if user is None or not user.is_active:
        raise AppError(401, "authentication_required", "Authentication is required.")
    return user


async def get_current_user(
    request: Request,
    session: DatabaseSession,
    user_id_header: Annotated[str | None, Header(alias="X-User-Id")] = None,
) -> User:
    """Resolve cookie identity first, then an explicitly-enabled dev fallback."""
    access_cookie_name = get_authx().config.JWT_ACCESS_COOKIE_NAME
    if access_cookie_name in request.cookies:
        return await _cookie_user(request, session)
    return _development_header_user(session, user_id_header)


CurrentUser = Annotated[User, Depends(get_current_user)]
