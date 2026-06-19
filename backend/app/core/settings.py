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
    dev_identity_header_enabled: bool = True
    cors_origins: list[str] = Field(default_factory=list)
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


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
