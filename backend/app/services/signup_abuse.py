from datetime import timedelta
from hmac import digest
from urllib.parse import urlsplit

import httpx
from fastapi import Request
from sqlalchemy import DateTime, Integer, String, column, table
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.settings import get_settings
from app.core.time import utc_now

_buckets = table(
    "verification_email_buckets",
    column("key", String),
    column("hour", DateTime(timezone=True)),
    column("used", Integer),
)


def limit_verification_request(session: Session, request: Request) -> None:
    host = request.client.host if request.client is not None else "unknown"
    settings = get_settings()
    retry_after = _reserve_email_budget(
        session, f"ip:{host}", settings.verification_email_hourly_ip_limit
    )
    if retry_after is not None:
        raise AppError(
            429,
            "rate_limited",
            "Too many verification email requests. Try again later.",
            {"retry_after_seconds": retry_after},
            headers={"Retry-After": str(retry_after)},
        )
    session.commit()


def reserve_verification_delivery(session: Session, email: str) -> bool:
    domain = email.rsplit("@", 1)[-1]
    settings = get_settings()
    return (
        _reserve_email_budget(
            session, f"domain:{domain}", settings.verification_email_hourly_domain_limit
        )
        is None
    )


def _reserve_email_budget(session: Session, value: str, limit: int) -> int | None:
    settings = get_settings()
    now = utc_now()
    hour = now.replace(minute=0, second=0, microsecond=0)
    # Keep expired counters bounded across workers. Each key's current
    # window is still protected by the unique constraint and atomic upsert.
    session.execute(
        _buckets.delete().where(_buckets.c.hour < hour - timedelta(hours=24))
    )
    key = digest(settings.auth_jwt_secret_key.encode(), value.encode(), "sha256").hex()
    statement = insert(_buckets).values(key=key, hour=hour, used=1)
    statement = statement.on_conflict_do_update(
        index_elements=[_buckets.c.key, _buckets.c.hour],
        set_={"used": _buckets.c.used + 1},
        where=_buckets.c.used < limit,
    )
    if session.scalar(statement.returning(_buckets.c.used)) is None:
        return int((hour + timedelta(hours=1) - now).total_seconds()) + 1
    return None


def verify_signup_challenge(token: str | None) -> None:
    settings = get_settings()
    if not settings.turnstile_secret_key:
        if settings.environment == "production":
            raise _challenge_unavailable()
        return
    if not token:
        raise _challenge_failed()
    try:
        response = httpx.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={"secret": settings.turnstile_secret_key, "response": token},
            timeout=5,
        )
        response.raise_for_status()
        result = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise _challenge_unavailable() from error
    hostname = urlsplit(settings.frontend_base_url).hostname
    if (
        not isinstance(result, dict)
        or result.get("success") is not True
        or result.get("action") != "signup"
        or not hostname
        or result.get("hostname") != hostname
    ):
        raise _challenge_failed()


def _challenge_failed() -> AppError:
    return AppError(
        422, "signup_challenge_failed", "Complete the security check and try again."
    )


def _challenge_unavailable() -> AppError:
    return AppError(
        503,
        "signup_challenge_unavailable",
        "The signup security check is unavailable. Try again later.",
    )
