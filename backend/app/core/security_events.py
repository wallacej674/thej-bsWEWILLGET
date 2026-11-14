"""Structured security event logging (SEC-08).

Every security-relevant action (sign in, sign out, password change, token
reuse, role change, member removal, deletions, rate limits …) is written as
one JSON line to the "applytogether.security" logger, e.g.

    {"time": "...", "level": "warning", "event": "auth.refresh_reuse",
     "outcome": "blocked", "request_id": "...", "ip": "...",
     "user_agent": "...", "user_id": "..."}

Request id, IP and user agent come from RequestContextMiddleware, so call
sites only add what's specific to the event. Never pass passwords, tokens,
résumé text or raw email addresses: use email_hash() for emails.
"""

from __future__ import annotations

import contextvars
import json
import logging
import re
import uuid
from datetime import UTC, datetime
from typing import Any

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.device_cookie import keyed_digest

logger = logging.getLogger("applytogether.security")

_request_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id", default=None
)
_client_ip: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "client_ip", default=None
)
_user_agent: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "user_agent", default=None
)

REQUEST_ID_HEADER = "X-Request-ID"
# Accept a caller's request id only if it's short and plain.
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


class SecurityJsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname.lower(),
            **getattr(record, "security", {}),
        }
        return json.dumps(payload, default=str)


def configure_security_logging() -> None:
    """Send security events to stdout as JSON lines, once per process."""
    if any(isinstance(h.formatter, SecurityJsonFormatter) for h in logger.handlers):
        return
    handler = logging.StreamHandler()
    handler.setFormatter(SecurityJsonFormatter())
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


def email_hash(email: str) -> str:
    """A stable pseudonym for an email, so events can be correlated."""
    return keyed_digest("log-email", email.strip().lower())[:16]


def security_event(
    event: str,
    outcome: str,
    *,
    level: int = logging.INFO,
    **fields: Any,
) -> None:
    payload = {
        "event": event,
        "outcome": outcome,
        "request_id": _request_id.get(),
        "ip": _client_ip.get(),
        "user_agent": _user_agent.get(),
    }
    payload.update(
        {
            key: str(value) if isinstance(value, uuid.UUID) else value
            for key, value in fields.items()
            if value is not None
        }
    )
    logger.log(level, event, extra={"security": payload})


class RequestContextMiddleware:
    """Give each request an id (echoed as X-Request-ID) and note its origin."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope["headers"])
        incoming = headers.get(REQUEST_ID_HEADER.lower().encode(), b"").decode(
            "latin-1"
        )
        request_id = incoming if _SAFE_REQUEST_ID.match(incoming) else uuid.uuid4().hex
        client = scope.get("client")
        tokens = (
            _request_id.set(request_id),
            _client_ip.set(client[0] if client else None),
            _user_agent.set(
                headers.get(b"user-agent", b"").decode("latin-1")[:200] or None
            ),
        )

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", [])
                message["headers"] = [
                    *message["headers"],
                    (REQUEST_ID_HEADER.encode(), request_id.encode()),
                ]
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            for var, token in zip(
                (_request_id, _client_ip, _user_agent), tokens, strict=True
            ):
                var.reset(token)
