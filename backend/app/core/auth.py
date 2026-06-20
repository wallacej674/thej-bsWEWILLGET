from datetime import timedelta
from functools import lru_cache

from authx import AuthX, AuthXConfig

from app.core.settings import get_settings


@lru_cache
def get_authx() -> AuthX[None]:
    """Return the single AuthX cookie/JWT integration for this process."""
    settings = get_settings()
    config = AuthXConfig(
        JWT_SECRET_KEY=settings.auth_jwt_secret_key,
        JWT_TOKEN_LOCATION=["cookies"],
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(minutes=settings.auth_access_token_minutes),
        JWT_REFRESH_TOKEN_EXPIRES=timedelta(days=settings.auth_refresh_token_days),
        JWT_ACCESS_COOKIE_NAME="applytogether_access",
        JWT_ACCESS_COOKIE_PATH="/api/v1",
        JWT_REFRESH_COOKIE_NAME="applytogether_refresh",
        JWT_REFRESH_COOKIE_PATH="/api/v1/auth",
        JWT_COOKIE_SECURE=settings.auth_cookie_secure,
        JWT_COOKIE_SAMESITE=settings.auth_cookie_samesite,
        JWT_COOKIE_HTTP_ONLY=True,
        JWT_COOKIE_CSRF_PROTECT=True,
        JWT_ACCESS_CSRF_COOKIE_NAME="applytogether_csrf",
        JWT_ACCESS_CSRF_COOKIE_PATH="/",
        JWT_ACCESS_CSRF_HEADER_NAME="X-CSRF-Token",
        JWT_REFRESH_CSRF_COOKIE_NAME="applytogether_refresh_csrf",
        JWT_REFRESH_CSRF_COOKIE_PATH="/",
        JWT_REFRESH_CSRF_HEADER_NAME="X-Refresh-CSRF-Token",
        JWT_CSRF_METHODS=["POST", "PUT", "PATCH", "DELETE"],
    )
    return AuthX(config=config)
