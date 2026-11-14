"""Signed "device cookies" that let a browser prove it has signed in before.

Following OWASP's device-cookie defence against lockout attacks: a browser
that has completed a sign-in for an account carries a cookie naming that
account and a random device id, signed with a server key. Sign-in attempts
from such a browser are throttled on their own, so a stranger hammering the
account can't lock its owner out of devices they already use.

The cookie is not a credential: it only changes which throttle bucket a
failed attempt counts against.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from uuid import UUID

from app.core.settings import get_settings

DEVICE_COOKIE_NAME = "applytogether_device"
DEVICE_COOKIE_PATH = "/api/v1/auth"


def _key(purpose: str) -> bytes:
    """A key for one purpose, derived from the app secret."""
    secret = get_settings().auth_jwt_secret_key.encode("utf-8")
    return hmac.new(
        secret, f"applytogether:{purpose}".encode(), hashlib.sha256
    ).digest()


def keyed_digest(purpose: str, value: str) -> str:
    """A hex HMAC of `value`, so lookups work without storing the value."""
    return hmac.new(_key(purpose), value.encode("utf-8"), hashlib.sha256).hexdigest()


def _signature(user_id: UUID, device_id: str) -> str:
    mac = hmac.new(
        _key("device-cookie"), f"{user_id}:{device_id}".encode(), hashlib.sha256
    ).digest()
    return base64.urlsafe_b64encode(mac).rstrip(b"=").decode("ascii")


@dataclass(frozen=True)
class DeviceClaim:
    user_id: UUID
    device_id: str


def issue_device_cookie(user_id: UUID) -> str:
    device_id = secrets.token_urlsafe(16)
    return f"{user_id}.{device_id}.{_signature(user_id, device_id)}"


def read_device_cookie(value: str | None) -> DeviceClaim | None:
    """The claim in a cookie whose signature checks out, else None."""
    if not value or len(value) > 200:
        return None
    parts = value.split(".")
    if len(parts) != 3:
        return None
    raw_user_id, device_id, signature = parts
    try:
        user_id = UUID(raw_user_id)
    except ValueError:
        return None
    if not device_id or not hmac.compare_digest(
        signature, _signature(user_id, device_id)
    ):
        return None
    return DeviceClaim(user_id=user_id, device_id=device_id)
