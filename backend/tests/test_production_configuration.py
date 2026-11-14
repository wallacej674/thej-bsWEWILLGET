"""SEC-04: production refuses to start with unsafe settings."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.settings import Settings, get_settings, jwt_secret_is_strong
from app.main import create_app

STRONG_SECRET = "q8VZ3m1kT7xN2pR5wC9yB4hL6dF0sJ8gA1eK3uM7"


def production(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "environment": "production",
        "database_url": "postgresql+psycopg://app:pw@db.example.com/app?sslmode=verify-full",
        "auth_jwt_secret_key": STRONG_SECRET,
        "auth_cookie_secure": True,
        "dev_identity_header_enabled": False,
        "cors_origins": ["https://app.example.com"],
        "allowed_hosts": ["api.example.com"],
        "smtp_username": "mailer",
        "smtp_app_password": "app-password",
        "smtp_from_email": "noreply@example.com",
    }
    values.update(overrides)
    return Settings(**values)


def test_a_safe_production_configuration_starts() -> None:
    production().validate_configuration()


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"auth_jwt_secret_key": "short-secret"}, "AUTH_JWT_SECRET_KEY"),
        (
            {
                "auth_jwt_secret_key": "generate-a-long-random-secret-and-keep-it-out-of-git"
            },
            "AUTH_JWT_SECRET_KEY",
        ),
        ({"auth_jwt_secret_key": "a" * 64}, "AUTH_JWT_SECRET_KEY"),
        ({"cors_origins": ["http://app.example.com"]}, "https://"),
        ({"dev_identity_header_enabled": True}, "DEV_IDENTITY_HEADER_ENABLED"),
        (
            {"database_url": "postgresql+psycopg://app:pw@db.example.com/app"},
            "sslmode",
        ),
        (
            {"database_url": "postgresql+psycopg://app:pw@db/app?sslmode=require"},
            "sslmode",
        ),
        ({"allowed_hosts": ["*"]}, "ALLOWED_HOSTS"),
        ({"allowed_hosts": []}, "ALLOWED_HOSTS"),
        ({"auth_cookie_secure": False}, "AUTH_COOKIE_SECURE"),
    ],
)
def test_unsafe_production_settings_refuse_to_start(
    overrides: dict[str, Any], message: str
) -> None:
    with pytest.raises(RuntimeError, match=message):
        production(**overrides).validate_configuration()


def test_environment_must_be_set_explicitly(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    with pytest.raises(ValueError, match="environment"):
        Settings(
            database_url="postgresql+psycopg://app:pw@localhost/app",
            auth_jwt_secret_key=STRONG_SECRET,
            _env_file=None,  # type: ignore[call-arg]
        )


def test_secret_strength_rules() -> None:
    assert jwt_secret_is_strong(STRONG_SECRET)
    assert not jwt_secret_is_strong("test-only-authx-signing-secret-change-me")
    assert not jwt_secret_is_strong("abcabcabcabcabcabcabcabcabcabcabcabc")


def test_api_docs_are_only_served_in_development() -> None:
    hidden = TestClient(create_app(production(allowed_hosts=["testserver"])))
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert hidden.get(path).status_code == 404

    shown = TestClient(
        create_app(production(environment="development", allowed_hosts=["testserver"]))
    )
    assert shown.get("/openapi.json").status_code == 200


def test_unknown_host_headers_are_rejected() -> None:
    client = TestClient(create_app(production(allowed_hosts=["api.example.com"])))
    assert client.get("/health").status_code == 400
    assert client.get("/health", headers={"Host": "api.example.com"}).status_code == 200


def test_the_dev_identity_header_only_works_from_this_machine(
    api_client, active_member, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "dev_identity_header_enabled", True)
    headers = {"X-User-Id": str(active_member.id)}

    remote = TestClient(api_client.app, client=("203.0.113.9", 4000))
    assert remote.get("/api/v1/users/me", headers=headers).status_code == 401

    local = TestClient(api_client.app, client=("127.0.0.1", 4000))
    assert local.get("/api/v1/users/me", headers=headers).status_code == 200
