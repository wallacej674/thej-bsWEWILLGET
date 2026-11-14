import logging
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.security_events import security_event


class AppError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Any = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        self.headers = headers


def error_payload(code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details}}


async def app_error_handler(request: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, AppError):
        raise TypeError("Expected AppError")
    if error.status_code in {401, 403}:
        # Refused access is worth a trail; 403s (a signed-in user reaching
        # for something not theirs) more so than ordinary expired sessions.
        security_event(
            "access.denied",
            error.code,
            level=logging.WARNING if error.status_code == 403 else logging.INFO,
            status=error.status_code,
            method=request.method,
            path=request.url.path,
        )
    return JSONResponse(
        status_code=error.status_code,
        content=jsonable_encoder(
            error_payload(error.code, error.message, error.details)
        ),
        headers=error.headers,
    )


async def validation_error_handler(_request: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, RequestValidationError):
        raise TypeError("Expected RequestValidationError")
    return JSONResponse(
        status_code=422,
        content=error_payload(
            "validation_error",
            "Request validation failed.",
            jsonable_encoder(error.errors()),
        ),
    )


ExceptionHandler = Callable[[Request, Exception], Awaitable[JSONResponse]]


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
