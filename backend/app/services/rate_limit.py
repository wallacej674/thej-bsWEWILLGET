"""Request rate limits shared by every API worker (SEC-02).

Counts live in Postgres, in fixed windows aligned to the clock, so limits
hold across processes without extra infrastructure. Each limit counts one
thing: an IP address, an email address, a user or a session. Keys are
stored as keyed hashes.

Limits are written like "10/minute" in Settings, and switched off with
RATE_LIMITS_ENABLED=false (the test suite does this by default).
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.device_cookie import keyed_digest
from app.core.errors import AppError
from app.core.security_events import security_event
from app.core.settings import get_settings
from app.core.time import utc_now
from app.models.rate_limit import RateLimitCounter

UNIT_SECONDS = {"second": 1, "minute": 60, "hour": 3600, "day": 86400}
EPOCH = datetime(1970, 1, 1, tzinfo=UTC)


@dataclass(frozen=True)
class Rate:
    limit: int
    seconds: int


def parse_rate(value: str) -> Rate:
    """Read "10/minute", "5/hour" or "30/second" into a Rate."""
    count, _, unit = value.partition("/")
    unit = unit.strip().removesuffix("s")
    if unit not in UNIT_SECONDS or not count.strip().isdigit():
        raise ValueError(f"Not a rate: {value!r} (expected e.g. '10/minute').")
    return Rate(limit=int(count), seconds=UNIT_SECONDS[unit])


def window_start(now: datetime, seconds: int) -> datetime:
    elapsed = int((now - EPOCH).total_seconds())
    return EPOCH + timedelta(seconds=elapsed - elapsed % seconds)


def rate_limited(retry_after_seconds: int) -> AppError:
    wait = max(1, retry_after_seconds)
    if wait < 60:
        when = f"{wait} second{'' if wait == 1 else 's'}"
    else:
        minutes = math.ceil(wait / 60)
        when = f"{minutes} minute{'' if minutes == 1 else 's'}"
    return AppError(
        429,
        "rate_limited",
        f"Too many requests. Try again in {when}.",
        {"retry_after_seconds": wait},
        headers={"Retry-After": str(wait)},
    )


def enforce(session: Session, rule: str, key: str, rate: str) -> None:
    """Count one request against `rule` for `key`; raise 429 once over."""
    if not get_settings().rate_limits_enabled:
        return
    parsed = parse_rate(rate)
    now = utc_now()
    start = window_start(now, parsed.seconds)
    hits = session.execute(
        insert(RateLimitCounter)
        .values(
            key_digest=keyed_digest("rate-limit", f"{rule}:{key}"),
            window_start=start,
            hits=1,
        )
        .on_conflict_do_update(
            index_elements=[RateLimitCounter.key_digest, RateLimitCounter.window_start],
            set_={"hits": RateLimitCounter.hits + 1},
        )
        .returning(RateLimitCounter.hits)
    ).scalar_one()
    # Commit now: the count must stick even if the request then fails.
    session.commit()
    if hits > parsed.limit:
        security_event(
            "rate_limit.exceeded", "blocked", level=logging.WARNING, rule=rule
        )
        window_end = start + timedelta(seconds=parsed.seconds)
        raise rate_limited(math.ceil((window_end - now).total_seconds()))
