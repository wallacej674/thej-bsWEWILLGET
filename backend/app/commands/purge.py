"""Delete data that has outlived its purpose (SEC-14).

Run daily (cron, a scheduled task, or the host's job runner):

    python -m app.commands.purge

It removes:

- sign-in sessions 30 days after they expired or were revoked;
- pending registrations 7 days after they expired or were used (they hold
  password hashes), and password reset links likewise;
- sign-in throttle buckets idle for a day (their history is forgotten by
  then anyway) and rate-limit windows older than a day;
- soft-deleted applications after PURGE_DELETED_APPLICATIONS_AFTER_DAYS,
  only if that is set. It's off by default because users can restore
  deleted applications, so turning it on is a product decision that should
  come with a notice in the "Recently deleted" bin.

Safe to run repeatedly.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import Delete, and_, delete, or_
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.core.time import utc_now
from app.db.session import get_session_factory
from app.models.application import JobApplication
from app.models.auth_session import AuthenticationSession
from app.models.login_throttle import LoginThrottleBucket
from app.models.password_reset import PasswordResetToken
from app.models.pending_registration import PendingRegistration
from app.models.rate_limit import RateLimitCounter

SESSION_RETENTION = timedelta(days=30)
REGISTRATION_RETENTION = timedelta(days=7)
THROTTLE_RETENTION = timedelta(days=1)
RATE_LIMIT_RETENTION = timedelta(days=1)


def _count(session: Session, statement: Delete) -> int:
    return int(getattr(session.execute(statement), "rowcount", 0) or 0)


def purge(session: Session, now: datetime | None = None) -> dict[str, int]:
    """Delete expired rows; returns how many of each kind went."""
    now = now or utc_now()
    session_cutoff = now - SESSION_RETENTION
    registration_cutoff = now - REGISTRATION_RETENTION
    removed = {
        "auth_sessions": _count(
            session,
            delete(AuthenticationSession).where(
                or_(
                    AuthenticationSession.expires_at < session_cutoff,
                    AuthenticationSession.revoked_at < session_cutoff,
                )
            ),
        ),
        "pending_registrations": _count(
            session,
            delete(PendingRegistration).where(
                or_(
                    PendingRegistration.expires_at < registration_cutoff,
                    PendingRegistration.consumed_at < registration_cutoff,
                )
            ),
        ),
        "login_throttle_buckets": _count(
            session,
            delete(LoginThrottleBucket).where(
                and_(
                    or_(
                        LoginThrottleBucket.last_failure_at.is_(None),
                        LoginThrottleBucket.last_failure_at < now - THROTTLE_RETENTION,
                    ),
                    or_(
                        LoginThrottleBucket.locked_until.is_(None),
                        LoginThrottleBucket.locked_until < now,
                    ),
                )
            ),
        ),
        "password_reset_tokens": _count(
            session,
            delete(PasswordResetToken).where(
                or_(
                    PasswordResetToken.expires_at < registration_cutoff,
                    PasswordResetToken.consumed_at < registration_cutoff,
                )
            ),
        ),
        "rate_limit_counters": _count(
            session,
            delete(RateLimitCounter).where(
                RateLimitCounter.window_start < now - RATE_LIMIT_RETENTION
            ),
        ),
        "deleted_applications": 0,
    }
    days = get_settings().purge_deleted_applications_after_days
    if days is not None:
        removed["deleted_applications"] = _count(
            session,
            delete(JobApplication).where(
                JobApplication.deleted_at < now - timedelta(days=days)
            ),
        )
    session.flush()
    return removed


def main() -> None:
    session = get_session_factory()()
    try:
        removed = purge(session)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
    for kind, count in removed.items():
        print(f"{kind}: {count} removed")


if __name__ == "__main__":
    main()
