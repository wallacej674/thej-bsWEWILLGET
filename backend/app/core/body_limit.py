"""Reject request bodies over a size limit before they're buffered (SEC-06).

Checks Content-Length up front, and counts the bytes of bodies that don't
declare one (chunked uploads) as they stream in. Either way the client gets
413 request_too_large rather than the server reading the whole body.
"""

from __future__ import annotations

import json

from starlette.types import ASGIApp, Message, Receive, Scope, Send

TOO_LARGE_BODY = json.dumps(
    {
        "error": {
            "code": "request_too_large",
            "message": "That request is too large.",
            "details": None,
        }
    }
).encode()


class _BodyTooLarge(Exception):
    pass


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        declared = dict(scope["headers"]).get(b"content-length")
        if (
            declared is not None
            and declared.isdigit()
            and int(declared) > self.max_bytes
        ):
            await self._reject(send)
            return

        received = 0
        too_large = False
        replied = False

        async def limited_receive() -> Message:
            nonlocal received, too_large
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    too_large = True
                    # Stop reading. FastAPI turns this into a 400, which the
                    # send wrapper below swaps for a 413.
                    raise _BodyTooLarge
            return message

        async def guarded_send(message: Message) -> None:
            nonlocal replied
            if too_large:
                if not replied:
                    replied = True
                    await self._reject(send)
                return
            await send(message)

        try:
            await self.app(scope, limited_receive, guarded_send)
        except _BodyTooLarge:
            if not replied:
                await self._reject(send)

    @staticmethod
    async def _reject(send: Send) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(TOO_LARGE_BODY)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": TOO_LARGE_BODY})
