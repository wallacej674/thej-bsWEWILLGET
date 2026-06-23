from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    app_name: str = "ApplyTogether API"
    api_v1_prefix: str = "/api/v1"
    database_url: PostgresDsn
    dev_identity_header_enabled: bool = False
    cors_origins: list[str] = Field(default_factory=list)
    auth_jwt_secret_key: str
    auth_access_token_minutes: int = 15
    auth_refresh_token_days: int = 20
    auth_cookie_secure: bool = True
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
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
    seed_jonathan_email: str = "jonathan@example.test"
    seed_jonathan_display_name: str = "Jonathan"
    seed_kareem_email: str = "kareem@example.test"
    seed_kareem_display_name: str = "Kareem"

    def validate_identity_configuration(self) -> None:
        if self.dev_identity_header_enabled and self.environment not in {
            "development",
            "test",
        }:
            message = "DEV_IDENTITY_HEADER_ENABLED may only be enabled in development or test."
            raise RuntimeError(message)
        if self.environment == "production" and not self.auth_cookie_secure:
            raise RuntimeError("AUTH_COOKIE_SECURE must be enabled in production.")
        if "*" in self.cors_origins:
            raise RuntimeError(
                "CORS_ORIGINS must not include a wildcard with credentials."
            )
        if self.environment == "production" and (
            not self.smtp_username
            or not self.smtp_app_password
            or not self.smtp_from_email
        ):
            raise RuntimeError(
                "SMTP_USERNAME, SMTP_APP_PASSWORD, and SMTP_FROM_EMAIL "
                "are required in production."
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
