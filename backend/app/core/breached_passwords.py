"""Refuse passwords already exposed in data breaches (SEC-24).

Uses Have I Been Pwned's Pwned Passwords range API with k-anonymity: only
the first five hex characters of the password's SHA-1 are sent, and the
match happens here, so neither the password nor its full hash leaves the
server. Responses are padded, so even the size of the answer reveals
nothing.

If the service can't be reached, the check fails open (the password is
allowed and a warning is logged), so an outage never blocks sign-up or
password changes.
"""

from __future__ import annotations

import hashlib
import logging

import httpx

from app.core.passwords import PasswordPolicyError
from app.core.settings import get_settings

logger = logging.getLogger(__name__)

RANGE_URL = "https://api.pwnedpasswords.com/range/{prefix}"
BREACHED_MESSAGE = (
    "This password has appeared in a known data breach, so attackers try it "
    "first. Choose a different one."
)


def breach_count(password: str) -> int | None:
    """How often the password appears in breaches; None if unknown."""
    digest = hashlib.sha1(password.encode("utf-8"), usedforsecurity=False)
    sha1 = digest.hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]
    try:
        response = httpx.get(
            RANGE_URL.format(prefix=prefix),
            headers={
                "Add-Padding": "true",
                "User-Agent": "ApplyTogether-password-check",
            },
            timeout=get_settings().breached_password_timeout_seconds,
        )
        response.raise_for_status()
    except httpx.HTTPError:
        logger.warning("Breached-password check unavailable; allowing the password.")
        return None
    for line in response.text.splitlines():
        candidate, _, count = line.strip().partition(":")
        if candidate == suffix:
            # Padding entries have a count of 0 and mean "not breached".
            return int(count) if count.isdigit() else 0
    return 0


def check_not_breached(password: str) -> None:
    """Raise PasswordPolicyError if the password is known to be breached."""
    if not get_settings().breached_password_check_enabled:
        return
    count = breach_count(password)
    if count:
        raise PasswordPolicyError(BREACHED_MESSAGE)
