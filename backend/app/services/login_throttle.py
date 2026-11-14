"""Sign-in throttling that a stranger can't use to lock someone out (SEC-03).

Failed attempts are counted per *source*, not per account:

- a recognised device (a browser carrying a valid device cookie for the
  account, see app/core/device_cookie.py), or
- otherwise the client IP.

So someone hammering your email from their machine only slows themselves
down. Attempts from unrecognised devices are also counted together in an
account-wide "untrusted" backstop with a higher limit, which catches
guessing spread across many IPs. When that trips it pauses unrecognised
devices only, so browsers you already use keep working, and you get one
email about it.

Locks grow progressively (1, 2, 4, 8 … minutes, capped) and a lock that has
run out starts a fresh count, so one typo afterwards doesn't re-lock (SEC-19).

Buckets are keyed by the typed email, whether or not an account exists, so
throttling behaves the same for unknown emails and reveals nothing.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.device_cookie import keyed_digest
from app.core.settings import get_settings
from app.core.time import utc_now
from app.models.login_throttle import LoginThrottleBucket

Scope = Literal["device", "ip", "untrusted"]

# After this long without a failure, a bucket's lock history is forgotten.
QUIET_RESET = timedelta(hours=24)
# At most one "attempts paused" email per account in this period.
NOTICE_INTERVAL = timedelta(hours=24)


@dataclass(frozen=True)
class LoginSource:
    scope: Literal["device", "ip"]
    value: str

    @classmethod
    def device(cls, device_id: str) -> LoginSource:
        return cls("device", device_id)

    @classmethod
    def ip(cls, address: str) -> LoginSource:
        return cls("ip", address)

    @property
    def trusted(self) -> bool:
        return self.scope == "device"


class LoginThrottledError(Exception):
    """This source may not try again yet."""

    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__("Too many sign-in attempts.")
        self.retry_after_seconds = retry_after_seconds

    @property
    def retry_after_minutes(self) -> int:
        return max(1, math.ceil(self.retry_after_seconds / 60))


@dataclass(frozen=True)
class FailureOutcome:
    # Set when the account-wide backstop has just paused unrecognised
    # devices and the owner hasn't been told recently.
    notify_owner: bool = False
    paused_for_seconds: int = 0


def lock_duration(lock_count: int) -> timedelta:
    """How long the (lock_count + 1)th lock lasts: doubling, then capped."""
    settings = get_settings()
    cap = settings.login_throttle_max_lock_minutes * 60
    seconds = settings.login_throttle_base_lock_seconds * 2 ** min(lock_count, 20)
    return timedelta(seconds=min(seconds, cap))


def count_failure(bucket: LoginThrottleBucket, threshold: int, now: datetime) -> bool:
    """Record one failure on `bucket`. True when this failure locks it."""
    window = timedelta(minutes=get_settings().login_throttle_window_minutes)
    if bucket.locked_until is not None and bucket.locked_until > now:
        return False
    if (
        bucket.last_failure_at is not None
        and now - bucket.last_failure_at >= QUIET_RESET
    ):
        bucket.lock_count = 0
        bucket.failures = 0
        bucket.window_started_at = now
    if bucket.locked_until is not None:
        # The last lock has run out: start counting afresh.
        bucket.locked_until = None
        bucket.failures = 0
        bucket.window_started_at = now
    if now - bucket.window_started_at > window:
        bucket.failures = 0
        bucket.window_started_at = now

    bucket.failures += 1
    bucket.last_failure_at = now
    if bucket.failures < threshold:
        return False
    bucket.locked_until = now + lock_duration(bucket.lock_count)
    bucket.lock_count += 1
    bucket.failures = 0
    return True


class LoginThrottle:
    UNTRUSTED = "*"

    def __init__(self, session: Session) -> None:
        self._session = session
        self._settings = get_settings()

    def check(self, email: str, source: LoginSource) -> None:
        """Raise LoginThrottledError if `source` must wait before trying."""
        now = utc_now()
        digests = [digest for _scope, digest, _limit in self._buckets(source)]
        locks = self._session.scalars(
            select(LoginThrottleBucket.locked_until).where(
                LoginThrottleBucket.email_digest == self._email_digest(email),
                LoginThrottleBucket.source_digest.in_(digests),
                LoginThrottleBucket.locked_until > now,
            )
        ).all()
        active = [lock for lock in locks if lock is not None]
        if active:
            wait = max(active) - now
            raise LoginThrottledError(math.ceil(wait.total_seconds()))

    def record_failure(self, email: str, source: LoginSource) -> FailureOutcome:
        now = utc_now()
        email_digest = self._email_digest(email)
        outcome = FailureOutcome()
        for scope, source_digest, threshold in self._buckets(source):
            bucket = self._locked_bucket(email_digest, scope, source_digest, now)
            if not count_failure(bucket, threshold, now) or scope != "untrusted":
                continue
            if (
                bucket.notified_at is None
                or now - bucket.notified_at >= NOTICE_INTERVAL
            ):
                bucket.notified_at = now
                assert bucket.locked_until is not None
                outcome = FailureOutcome(
                    notify_owner=True,
                    paused_for_seconds=math.ceil(
                        (bucket.locked_until - now).total_seconds()
                    ),
                )
        self._session.flush()
        return outcome

    def record_success(self, email: str, source: LoginSource) -> None:
        """Forget this source's failures; leave the backstop to run out."""
        _scope, own_digest, _limit = self._buckets(source)[0]
        self._session.execute(
            delete(LoginThrottleBucket).where(
                LoginThrottleBucket.email_digest == self._email_digest(email),
                LoginThrottleBucket.source_digest == own_digest,
            )
        )

    def clear(self, email: str) -> None:
        """Forget every bucket for an email (an administrator's unlock)."""
        self._session.execute(
            delete(LoginThrottleBucket).where(
                LoginThrottleBucket.email_digest == self._email_digest(email)
            )
        )

    def _buckets(self, source: LoginSource) -> list[tuple[Scope, str, int]]:
        own: tuple[Scope, str, int] = (
            source.scope,
            self._source_digest(source.scope, source.value),
            self._settings.login_throttle_source_failures,
        )
        if source.trusted:
            return [own]
        backstop: tuple[Scope, str, int] = (
            "untrusted",
            self._source_digest("untrusted", self.UNTRUSTED),
            self._settings.login_throttle_account_failures,
        )
        return [own, backstop]

    def _locked_bucket(
        self, email_digest: str, scope: Scope, source_digest: str, now: datetime
    ) -> LoginThrottleBucket:
        self._session.execute(
            insert(LoginThrottleBucket)
            .values(
                id=uuid4(),
                email_digest=email_digest,
                source_digest=source_digest,
                scope=scope,
                failures=0,
                lock_count=0,
                window_started_at=now,
            )
            .on_conflict_do_nothing(constraint="uq_login_throttle_buckets_key")
        )
        return self._session.scalars(
            select(LoginThrottleBucket)
            .where(
                LoginThrottleBucket.email_digest == email_digest,
                LoginThrottleBucket.source_digest == source_digest,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        ).one()

    @staticmethod
    def _email_digest(email: str) -> str:
        return keyed_digest("login-email", email)

    @staticmethod
    def _source_digest(scope: str, value: str) -> str:
        return keyed_digest("login-source", f"{scope}:{value}")
