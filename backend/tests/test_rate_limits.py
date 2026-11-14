"""SEC-02: request rate limits for auth and expensive endpoints."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.passwords import hash_password
from app.core.settings import get_settings
from app.services import rate_limit
from app.services.rate_limit import Rate, parse_rate, window_start

PASSWORD = "correct horse battery staple"


@pytest.fixture
def limits(monkeypatch: pytest.MonkeyPatch):
    """Turn limits on; returns a setter for tightening one."""
    settings = get_settings()
    monkeypatch.setattr(settings, "rate_limits_enabled", True)

    def tighten(name: str, value: str) -> None:
        monkeypatch.setattr(settings, name, value)

    return tighten


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 11, 14, 12, 0, 30, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now


def assert_rate_limited(response) -> None:
    assert response.status_code == 429
    body = response.json()["error"]
    assert body["code"] == "rate_limited"
    assert body["message"].startswith("Too many requests. Try again in")
    assert (
        int(response.headers["Retry-After"]) == body["details"]["retry_after_seconds"]
    )


def test_rates_parse_and_windows_align() -> None:
    assert parse_rate("10/minute") == Rate(10, 60)
    assert parse_rate("5/hours") == Rate(5, 3600)
    with pytest.raises(ValueError):
        parse_rate("ten/minute")
    with pytest.raises(ValueError):
        parse_rate("10/fortnight")
    now = datetime(2026, 11, 14, 12, 34, 56, tzinfo=UTC)
    assert window_start(now, 60) == datetime(2026, 11, 14, 12, 34, tzinfo=UTC)
    assert window_start(now, 3600) == datetime(2026, 11, 14, 12, 0, tzinfo=UTC)


def test_one_ip_cannot_spray_logins_across_many_emails(api_client, limits) -> None:
    for _ in range(10):
        response = api_client.post(
            "/api/v1/auth/login",
            json={"email": f"{uuid4().hex}@example.test", "password": "guess"},
        )
        assert response.status_code == 401

    blocked = api_client.post(
        "/api/v1/auth/login", json={"email": "jonathan@example.test", "password": "x"}
    )
    assert_rate_limited(blocked)

    # Another address is unaffected: changing email doesn't help, but the
    # limit is per IP, not global.
    other = TestClient(api_client.app, client=("198.51.100.20", 4000))
    response = other.post(
        "/api/v1/auth/login", json={"email": "jonathan@example.test", "password": "x"}
    )
    assert response.status_code == 401


def test_resending_to_one_email_is_capped_whatever_the_ip(api_client, limits) -> None:
    email = {"email": "pending@example.test"}
    for index in range(3):
        client = TestClient(api_client.app, client=(f"203.0.113.{index}", 4000))
        assert (
            client.post("/api/v1/auth/resend-verification", json=email).status_code
            == 202
        )

    fresh_ip = TestClient(api_client.app, client=("203.0.113.50", 4000))
    assert_rate_limited(fresh_ip.post("/api/v1/auth/resend-verification", json=email))


def test_limits_reset_when_the_window_turns_over(
    api_client, limits, monkeypatch: pytest.MonkeyPatch
) -> None:
    clock = Clock()
    monkeypatch.setattr(rate_limit, "utc_now", clock)
    limits("rate_limit_verify_per_ip", "2/minute")
    body = {"token": "not-a-real-token"}

    for _ in range(2):
        assert (
            api_client.post("/api/v1/auth/verify-email", json=body).status_code == 400
        )
    blocked = api_client.post("/api/v1/auth/verify-email", json=body)
    assert_rate_limited(blocked)
    assert blocked.headers["Retry-After"] == "30"

    clock.now += timedelta(seconds=31)
    assert api_client.post("/api/v1/auth/verify-email", json=body).status_code == 400


def test_signups_are_capped_per_ip(api_client, limits) -> None:
    limits("rate_limit_signup_per_ip", "1/hour")
    payload = {
        "display_name": "Amara",
        "email": "amara@example.test",
        "password": PASSWORD,
        "workspace_name": "Amara's search",
    }
    first = api_client.post("/api/v1/auth/signup", json=payload)
    assert first.status_code in {202, 503}  # 503 when SMTP isn't configured
    assert_rate_limited(api_client.post("/api/v1/auth/signup", json=payload))


def test_refresh_is_capped_per_session(
    api_client, limits, database_session, active_member
) -> None:
    limits("rate_limit_refresh_per_session", "1/minute")
    active_member.password_hash = hash_password(PASSWORD)
    database_session.flush()
    login = api_client.post(
        "/api/v1/auth/login",
        json={"email": active_member.email, "password": PASSWORD},
    )
    assert login.status_code == 204

    def refresh():
        csrf = api_client.cookies.get("applytogether_refresh_csrf")
        return api_client.post(
            "/api/v1/auth/refresh", headers={"X-Refresh-CSRF-Token": csrf or ""}
        )

    assert refresh().status_code == 204
    assert_rate_limited(refresh())


def test_autofill_is_capped_per_user(
    api_client, limits, active_member, shared_workspace
) -> None:
    limits("rate_limit_autofill_per_user", "1/minute")
    url = f"/api/v1/workspaces/{shared_workspace.id}/applications/autofill"
    headers = {"X-User-Id": str(active_member.id)}
    # A blocked URL is refused locally, so no outside page is fetched.
    body = {"job_posting_url": "http://localhost/jobs/1"}

    assert api_client.post(url, json=body, headers=headers).status_code == 400
    assert_rate_limited(api_client.post(url, json=body, headers=headers))


def test_resume_uploads_are_capped_per_user(api_client, limits, active_member) -> None:
    limits("rate_limit_resume_upload_per_user", "1/hour")
    headers = {"X-User-Id": str(active_member.id)}
    upload = {"file": ("notes.txt", b"not a pdf", "text/plain")}

    assert (
        api_client.post(
            "/api/v1/profile/resume", files=upload, headers=headers
        ).status_code
        == 415
    )
    assert_rate_limited(
        api_client.post("/api/v1/profile/resume", files=upload, headers=headers)
    )
