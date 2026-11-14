import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.router import api_router
from app.api.routes.health import router as health_router
from app.core.errors import install_error_handlers
from app.core.settings import Settings, get_settings

# Headers the frontend actually sends (see frontend/src/api/client.ts).
ALLOWED_HEADERS = ["Accept", "Content-Type", "X-CSRF-Token", "X-Refresh-CSRF-Token"]
ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    get_settings().validate_configuration()
    yield


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=settings.log_level.upper())
    # Interactive API docs and the schema are for local development only.
    show_docs = settings.environment == "development"
    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
        docs_url="/docs" if show_docs else None,
        redoc_url="/redoc" if show_docs else None,
        openapi_url="/openapi.json" if show_docs else None,
    )
    install_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=ALLOWED_METHODS,
        allow_headers=ALLOWED_HEADERS
        + (["X-User-Id"] if settings.dev_identity_header_enabled else []),
    )
    # Added last so it runs first: reject unexpected Host headers outright.
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
    app.include_router(health_router)
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
