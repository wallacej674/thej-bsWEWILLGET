"""Forgot-password flow (SEC-10).

request_reset() emails a single-use link valid for PASSWORD_RESET_MINUTES,
but only if an active account with a password exists. Callers always answer
the same way, so the endpoint doesn't reveal which emails have accounts.
reset() checks the token, applies the password policy, sets the new
password (revoking every session and lifting any sign-in throttle), uses up
all of the user's outstanding reset links, and emails a notice.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta
from hashlib import sha256

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.breached_passwords import check_not_breached
from app.core.passwords import validate_password
from app.core.settings import get_settings
from app.core.time import utc_now
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.services.auth_service import AuthenticationService, normalize_email
from app.services.email_delivery import EmailDeliveryError, EmailSender

logger = logging.getLogger(__name__)


class InvalidResetTokenError(Exception):
    """The link is unknown, already used, or expired."""


def _digest(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


class PasswordResetService:
    def request_reset(
        self, session: Session, email: str, email_sender: EmailSender
    ) -> bool:
        """Email a reset link if the account exists. True when one was sent."""
        user = session.scalar(
            select(User).where(func.lower(User.email) == normalize_email(email))
        )
        if user is None or not user.is_active or user.password_hash is None:
            return False

        now = utc_now()
        self._use_up_links(session, user, now)
        token = secrets.token_urlsafe(32)
        session.add(
            PasswordResetToken(
                user_id=user.id,
                token_digest=_digest(token),
                expires_at=now
                + timedelta(minutes=get_settings().password_reset_minutes),
            )
        )
        session.commit()
        try:
            email_sender.send_password_reset_email(recipient=user.email, token=token)
        except EmailDeliveryError:
            logger.warning("Could not send a password reset email.")
            return False
        return True

    def reset(self, session: Session, token: str, new_password: str) -> User:
        """Set a new password from a reset link; raises on a bad link."""
        record = session.scalar(
            select(PasswordResetToken)
            .where(PasswordResetToken.token_digest == _digest(token))
            .with_for_update()
        )
        now = utc_now()
        if record is None or record.consumed_at is not None or record.expires_at <= now:
            raise InvalidResetTokenError
        user = session.get(User, record.user_id)
        if user is None or not user.is_active:
            raise InvalidResetTokenError

        # Raises PasswordPolicyError before anything changes.
        validate_password(new_password)
        check_not_breached(new_password)
        AuthenticationService().reset_password(
            session, user=user, password=new_password
        )
        self._use_up_links(session, user, now)
        session.commit()
        return user

    @staticmethod
    def _use_up_links(session: Session, user: User, now: datetime) -> None:
        session.execute(
            update(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.consumed_at.is_(None),
            )
            .values(consumed_at=now)
        )
