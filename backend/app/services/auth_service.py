from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from hashlib import sha256
from uuid import UUID

from authx.schema import TokenPayload
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.auth import get_authx
from app.core.breached_passwords import check_not_breached
from app.core.device_cookie import DeviceClaim
from app.core.passwords import (
    dummy_verify,
    hash_password,
    validate_password,
    verify_and_upgrade,
)
from app.core.settings import get_settings
from app.core.time import utc_now
from app.models.auth_session import AuthenticationSession
from app.models.user import User
from app.services.login_throttle import LoginSource, LoginThrottle


class InvalidCredentialsError(Exception):
    """A deliberately generic login failure."""

    def __init__(
        self, notify_user: User | None = None, paused_for_seconds: int = 0
    ) -> None:
        super().__init__("Invalid credentials.")
        # Set when unrecognised devices were just paused for this account,
        # so its owner should be told.
        self.notify_user = notify_user
        self.paused_for_seconds = paused_for_seconds


class InvalidSessionError(Exception):
    """A token does not map to an active server-side session."""


class RefreshTokenReuseError(InvalidSessionError):
    """A rotated refresh token was presented again."""


class CurrentPasswordInvalidError(Exception):
    """The supplied current password cannot authorize a password change."""


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str


@dataclass(frozen=True)
class AuthenticationResult(TokenPair):
    user: User
    session: AuthenticationSession
    # True when the browser already carried this account's device cookie.
    trusted_device: bool = False


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _digest_refresh_jti(jti: str) -> str:
    return sha256(jti.encode("utf-8")).hexdigest()


def _token_payload(token: str) -> TokenPayload:
    authx = get_authx()
    return TokenPayload.decode(
        token,
        key=authx.config.public_key,
        algorithms=[authx.config.JWT_ALGORITHM],
        audience=authx.config.JWT_DECODE_AUDIENCE,
        issuer=authx.config.JWT_DECODE_ISSUER,
    )


def _session_id(payload: TokenPayload) -> UUID:
    value = (payload.model_extra or {}).get("sid")
    if not isinstance(value, str):
        raise InvalidSessionError
    try:
        return UUID(value)
    except ValueError as error:
        raise InvalidSessionError from error


class AuthenticationService:
    def login(
        self,
        session: Session,
        *,
        email: str,
        password: str,
        client_ip: str = "unknown",
        device: DeviceClaim | None = None,
    ) -> AuthenticationResult:
        """Sign in, throttling failures per source (see login_throttle).

        Raises LoginThrottledError before checking the password when this
        source must wait, and InvalidCredentialsError for a wrong email or
        password. Callers should commit after InvalidCredentialsError so the
        failure is counted.
        """
        normalized_email = normalize_email(email)
        user = session.scalar(
            select(User).where(func.lower(User.email) == normalized_email)
        )
        trusted = device is not None and user is not None and device.user_id == user.id
        source = (
            LoginSource.device(device.device_id)
            if trusted and device is not None
            else LoginSource.ip(client_ip)
        )
        throttle = LoginThrottle(session)
        throttle.check(normalized_email, source)
        now = utc_now()

        if user is None or user.password_hash is None:
            dummy_verify(password)
            throttle.record_failure(normalized_email, source)
            raise InvalidCredentialsError

        verified_hash = user.password_hash
        verified, upgraded_hash = verify_and_upgrade(password, verified_hash)
        if not verified or not user.is_active:
            outcome = throttle.record_failure(normalized_email, source)
            notify = outcome.notify_owner and user.is_active
            raise InvalidCredentialsError(
                notify_user=user if notify else None,
                paused_for_seconds=outcome.paused_for_seconds,
            )

        # Coordinate session creation with account deletion and password changes.
        current = session.scalar(
            select(User)
            .where(User.id == user.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if (
            current is None
            or not current.is_active
            or current.password_hash != verified_hash
        ):
            raise InvalidCredentialsError
        throttle.record_success(normalized_email, source)
        if upgraded_hash is not None:
            user.password_hash = upgraded_hash
        user.last_login_at = now
        authentication_session = self._create_session(session, user, now)
        access_token, refresh_token = self._issue_token_pair(
            user, authentication_session
        )
        session.flush()
        return AuthenticationResult(
            user=user,
            session=authentication_session,
            access_token=access_token,
            refresh_token=refresh_token,
            trusted_device=trusted,
        )

    def refresh(self, session: Session, payload: TokenPayload) -> TokenPair:
        authentication_session = self._load_refresh_session(session, payload)
        user = session.get(User, authentication_session.user_id)
        if user is None or not user.is_active:
            authentication_session.revoked_at = utc_now()
            session.flush()
            raise InvalidSessionError

        access_token, refresh_token = self._issue_token_pair(
            user, authentication_session
        )
        refresh_payload = _token_payload(refresh_token)
        if refresh_payload.jti is None:
            raise RuntimeError("AuthX refresh tokens must contain a jti claim.")
        authentication_session.refresh_jti_hash = _digest_refresh_jti(
            refresh_payload.jti
        )
        authentication_session.last_refreshed_at = utc_now()
        session.flush()
        return TokenPair(access_token=access_token, refresh_token=refresh_token)

    def revoke_session(self, session: Session, payload: TokenPayload) -> None:
        try:
            user_id = UUID(payload.sub)
        except ValueError as error:
            raise InvalidSessionError from error
        session.execute(
            update(AuthenticationSession)
            .where(
                AuthenticationSession.id == _session_id(payload),
                AuthenticationSession.user_id == user_id,
                AuthenticationSession.revoked_at.is_(None),
            )
            .values(revoked_at=utc_now())
        )

    def change_password(
        self,
        session: Session,
        *,
        user: User,
        current_password: str,
        new_password: str,
    ) -> None:
        if user.password_hash is None:
            dummy_verify(current_password)
            raise CurrentPasswordInvalidError
        verified, _ = verify_and_upgrade(current_password, user.password_hash)
        if not verified:
            raise CurrentPasswordInvalidError

        validate_password(new_password)
        check_not_breached(new_password)
        user.password_hash = hash_password(new_password)
        user.password_changed_at = utc_now()
        self.revoke_all_sessions(session, user.id)
        session.flush()

    def reset_password(self, session: Session, *, user: User, password: str) -> None:
        """Administrative password assignment for existing accounts only.

        Also lifts any sign-in throttling on the account.
        """
        user.password_hash = hash_password(password)
        user.password_changed_at = utc_now()
        LoginThrottle(session).clear(normalize_email(user.email))
        self.revoke_all_sessions(session, user.id)
        session.flush()

    def revoke_all_sessions(self, session: Session, user_id: UUID) -> None:
        now = utc_now()
        active_sessions = session.scalars(
            select(AuthenticationSession).where(
                AuthenticationSession.user_id == user_id,
                AuthenticationSession.revoked_at.is_(None),
            )
        )
        for authentication_session in active_sessions:
            authentication_session.revoked_at = now

    def _create_session(
        self, session: Session, user: User, now: datetime
    ) -> AuthenticationSession:
        settings = get_settings()
        authentication_session = AuthenticationSession(
            user_id=user.id,
            # Replaced immediately once AuthX issues the initial refresh token.
            refresh_jti_hash="pending",
            expires_at=now + timedelta(days=settings.auth_refresh_token_days),
        )
        session.add(authentication_session)
        session.flush()
        return authentication_session

    def _issue_token_pair(
        self, user: User, authentication_session: AuthenticationSession
    ) -> tuple[str, str]:
        authx = get_authx()
        claims = {"sid": str(authentication_session.id)}
        access_token = authx.create_access_token(
            uid=str(user.id), fresh=True, data=claims
        )
        refresh_token = authx.create_refresh_token(uid=str(user.id), data=claims)
        refresh_payload = _token_payload(refresh_token)
        if refresh_payload.jti is None:
            raise RuntimeError("AuthX refresh tokens must contain a jti claim.")
        authentication_session.refresh_jti_hash = _digest_refresh_jti(
            refresh_payload.jti
        )
        return access_token, refresh_token

    def _load_refresh_session(
        self, session: Session, payload: TokenPayload
    ) -> AuthenticationSession:
        now = utc_now()
        authentication_session = session.scalar(
            select(AuthenticationSession)
            .where(AuthenticationSession.id == _session_id(payload))
            .with_for_update()
        )
        if (
            authentication_session is None
            or authentication_session.revoked_at is not None
            or authentication_session.expires_at <= now
            or payload.jti is None
        ):
            raise InvalidSessionError

        if authentication_session.refresh_jti_hash != _digest_refresh_jti(payload.jti):
            authentication_session.revoked_at = now
            session.flush()
            raise RefreshTokenReuseError
        return authentication_session
