from __future__ import annotations

import secrets
from datetime import timedelta
from hashlib import sha256

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.enums import MembershipRole
from app.core.passwords import hash_password
from app.core.settings import get_settings
from app.core.time import utc_now
from app.models.membership import WorkspaceMembership
from app.models.pending_registration import PendingRegistration
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.auth import SignupRequest
from app.services.email_delivery import EmailDeliveryError, EmailSender


def _token_digest(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


class RegistrationService:
    def signup(
        self, session: Session, payload: SignupRequest, email_sender: EmailSender
    ) -> None:
        now = utc_now()
        existing_user = session.scalar(
            select(User).where(func.lower(User.email) == payload.email)
        )
        if existing_user is not None:
            return

        existing = session.scalar(
            select(PendingRegistration).where(
                PendingRegistration.email == payload.email
            )
        )
        if existing is not None and existing.expires_at > now:
            return

        token = secrets.token_urlsafe(32)
        settings = get_settings()
        if existing is None:
            registration = PendingRegistration(email=payload.email)
            session.add(registration)
        else:
            registration = existing
        registration.display_name = payload.display_name
        registration.password_hash = hash_password(payload.password)
        registration.workspace_name = payload.workspace_name
        registration.token_digest = _token_digest(token)
        registration.expires_at = now + timedelta(
            hours=settings.email_verification_hours
        )
        registration.last_sent_at = now
        registration.consumed_at = None

        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            return

        try:
            email_sender.send_verification_email(
                recipient=registration.email,
                display_name=registration.display_name,
                token=token,
            )
        except EmailDeliveryError:
            registration.last_sent_at = None
            session.commit()
            raise

    def resend(self, session: Session, email: str, email_sender: EmailSender) -> None:
        active_user = session.scalar(
            select(User).where(func.lower(User.email) == email)
        )
        if active_user is not None:
            return
        registration = session.scalar(
            select(PendingRegistration)
            .where(PendingRegistration.email == email)
            .with_for_update()
        )
        if registration is None or registration.consumed_at is not None:
            return

        now = utc_now()
        settings = get_settings()
        if (
            registration.last_sent_at is not None
            and registration.last_sent_at
            + timedelta(seconds=settings.email_resend_cooldown_seconds)
            > now
        ):
            return

        token = secrets.token_urlsafe(32)
        registration.token_digest = _token_digest(token)
        registration.expires_at = now + timedelta(
            hours=settings.email_verification_hours
        )
        registration.last_sent_at = now
        session.commit()
        try:
            email_sender.send_verification_email(
                recipient=registration.email,
                display_name=registration.display_name,
                token=token,
            )
        except EmailDeliveryError:
            registration.last_sent_at = None
            session.commit()
            raise

    def verify(self, session: Session, token: str) -> None:
        now = utc_now()
        registration = session.scalar(
            select(PendingRegistration)
            .where(PendingRegistration.token_digest == _token_digest(token))
            .with_for_update()
        )
        if registration is None:
            raise InvalidVerificationTokenError
        if registration.consumed_at is not None:
            return
        if registration.expires_at <= now:
            raise InvalidVerificationTokenError

        user = session.scalar(
            select(User).where(func.lower(User.email) == registration.email)
        )
        if user is None:
            candidate = User(
                email=registration.email,
                display_name=registration.display_name,
                password_hash=registration.password_hash,
                is_active=True,
            )
            try:
                with session.begin_nested():
                    session.add(candidate)
                    session.flush()
                user = candidate
            except IntegrityError:
                user = session.scalar(
                    select(User).where(func.lower(User.email) == registration.email)
                )
                if user is None:
                    raise

        workspace = Workspace(name=registration.workspace_name)
        session.add(workspace)
        session.flush()
        session.add(
            WorkspaceMembership(
                workspace_id=workspace.id,
                user_id=user.id,
                role=MembershipRole.OWNER,
            )
        )
        registration.consumed_at = now
        session.commit()


class InvalidVerificationTokenError(Exception):
    """A verification token is missing, expired, or unknown."""
