import os
from functools import lru_cache
from typing import Literal
from urllib.parse import parse_qs, urlsplit

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=None if os.getenv("ENVIRONMENT") == "test" else ".env",
        extra="ignore",
    )

    # No default: a deploy that forgets ENVIRONMENT must fail to start rather
    # than quietly run with development behaviour (SEC-04).
    environment: Literal["development", "test", "production"]
    app_name: str = "ApplyTogether API"
    api_v1_prefix: str = "/api/v1"
    database_url: PostgresDsn
    # Optional separate connection for Alembic, as the schema-owning migrator
    # role; the API itself connects as a DML-only role (SEC-12).
    migration_database_url: PostgresDsn | None = None
    db_pool_size: int = 5
    db_max_overflow: int = 10
    # Server-side limits for the API's connections, in milliseconds.
    db_statement_timeout_ms: int = 5_000
    db_idle_in_transaction_timeout_ms: int = 10_000
    dev_identity_header_enabled: bool = False
    cors_origins: list[str] = Field(default_factory=list)
    # Host headers the API answers to. Production must list its own domains.
    allowed_hosts: list[str] = Field(
        default_factory=lambda: ["localhost", "127.0.0.1", "testserver"]
    )
    auth_jwt_secret_key: str
    auth_access_token_minutes: int = 15
    auth_refresh_token_days: int = 20
    auth_cookie_secure: bool = True
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    # Sign-in throttling (SEC-03). Failures are counted per source (a
    # recognised device or an IP) so a stranger can only slow themselves
    # down; a higher account-wide limit catches attempts spread across IPs
    # and only ever pauses unrecognised devices.
    login_throttle_source_failures: int = 5
    login_throttle_account_failures: int = 20
    login_throttle_window_minutes: int = 15
    login_throttle_base_lock_seconds: int = 60
    login_throttle_max_lock_minutes: int = 60
    login_device_cookie_days: int = 365
    # Request rate limits (SEC-02), as "count/second|minute|hour|day".
    # Largest request body the API accepts at all (SEC-06); resume uploads
    # are further capped at 3 MB.
    max_request_bytes: int = 4 * 1024 * 1024
    rate_limits_enabled: bool = True
    rate_limit_login_per_ip: str = "10/minute"
    rate_limit_signup_per_ip: str = "5/hour"
    rate_limit_resend_per_email: str = "3/hour"
    rate_limit_resend_per_ip: str = "10/hour"
    rate_limit_verify_per_ip: str = "20/minute"
    rate_limit_refresh_per_session: str = "30/minute"
    rate_limit_autofill_per_user: str = "20/minute"
    rate_limit_resume_upload_per_user: str = "10/hour"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_app_password: str | None = None
    smtp_from_email: str | None = None
    smtp_from_name: str = "ApplyTogether"
    smtp_starttls: bool = True
    smtp_timeout_seconds: int = 15
    frontend_base_url: str = "http://localhost:5173"
    email_verification_hours: int = 24
    email_resend_cooldown_seconds: int = 60
    openai_api_key: str | None = None
    openai_resume_tailor_model: str = "gpt-5.4-nano"
    openai_resume_tailor_max_input_tokens: int = 30_000
    openai_resume_tailor_max_output_tokens: int = 1_800
    openai_resume_tailor_timeout_seconds: int = 30
    log_level: str = "INFO"
    app_timezone: str = "America/Chicago"
    # Hard cap on active members per workspace, enforced on invite and accept.
    # Conservative default for the low-hundreds target; raise as scale grows.
    workspace_member_cap: int = 500
    seed_jonathan_email: str = "jonathan@example.test"
    seed_jonathan_display_name: str = "Jonathan"
    seed_kareem_email: str = "kareem@example.test"
    seed_kareem_display_name: str = "Kareem"

    def validate_configuration(self) -> None:
        """Refuse to start with settings that are unsafe (SEC-04)."""
        if self.dev_identity_header_enabled and self.environment not in {
            "development",
            "test",
        }:
            message = "DEV_IDENTITY_HEADER_ENABLED may only be enabled in development or test."
            raise RuntimeError(message)
        if "*" in self.cors_origins:
            raise RuntimeError(
                "CORS_ORIGINS must not include a wildcard with credentials."
            )
        if self.environment == "production":
            self._validate_production()

    def _validate_production(self) -> None:
        if not self.auth_cookie_secure:
            raise RuntimeError("AUTH_COOKIE_SECURE must be enabled in production.")
        if not jwt_secret_is_strong(self.auth_jwt_secret_key):
            raise RuntimeError(
                "AUTH_JWT_SECRET_KEY must be a random value of at least 32 bytes "
                "in production, not a placeholder."
            )
        insecure_origins = [
            origin for origin in self.cors_origins if not origin.startswith("https://")
        ]
        if insecure_origins:
            raise RuntimeError("CORS_ORIGINS must all use https:// in production.")
        if not self.allowed_hosts or "*" in self.allowed_hosts:
            raise RuntimeError(
                "ALLOWED_HOSTS must list the API's own host names in production."
            )
        if database_ssl_mode(str(self.database_url)) not in VERIFIED_SSL_MODES:
            raise RuntimeError(
                "DATABASE_URL must use sslmode=verify-full (or verify-ca) in "
                "production so the database certificate is checked."
            )
        if (
            not self.smtp_username
            or not self.smtp_app_password
            or not self.smtp_from_email
        ):
            raise RuntimeError(
                "SMTP_USERNAME, SMTP_APP_PASSWORD, and SMTP_FROM_EMAIL "
                "are required in production."
            )


# Secrets that appear in this repository and must never be used for real.
PLACEHOLDER_SECRETS = {
    "generate-a-long-random-secret-and-keep-it-out-of-git",
    "test-only-authx-signing-secret-change-me",
    "change-me",
    "secret",
}
VERIFIED_SSL_MODES = {"verify-full", "verify-ca"}


def jwt_secret_is_strong(secret: str) -> bool:
    """At least 32 bytes, not a known placeholder, and not trivially repetitive."""
    return (
        len(secret.encode("utf-8")) >= 32
        and secret not in PLACEHOLDER_SECRETS
        and len(set(secret)) >= 10
    )


def database_ssl_mode(url: str) -> str | None:
    values = parse_qs(urlsplit(url).query).get("sslmode")
    return values[-1] if values else None


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
