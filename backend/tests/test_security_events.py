"""SEC-08: security events are logged as structured JSON without secrets."""

import json
import logging

import pytest

from app.core.enums import MembershipRole
from app.core.passwords import hash_password
from app.core.security_events import SecurityJsonFormatter, email_hash
from app.core.settings import get_settings
from app.models.membership import WorkspaceMembership
from app.models.user import User

PASSWORD = "correct horse battery staple"


class Capture(logging.Handler):
    def __init__(self) -> None:
        super().__init__(level=logging.DEBUG)
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)

    def events(self, name: str | None = None) -> list[dict]:
        payloads = [getattr(record, "security", {}) for record in self.records]
        return [p for p in payloads if name is None or p.get("event") == name]

    def rendered(self) -> str:
        formatter = SecurityJsonFormatter()
        return "\n".join(formatter.format(record) for record in self.records)


@pytest.fixture
def log():
    logger = logging.getLogger("applytogether.security")
    capture = Capture()
    previous = logger.level
    logger.addHandler(capture)
    logger.setLevel(logging.DEBUG)
    yield capture
    logger.removeHandler(capture)
    logger.setLevel(previous)


@pytest.fixture
def member(database_session, active_member):
    active_member.password_hash = hash_password(PASSWORD)
    database_session.flush()
    return active_member


def login(api_client, password=PASSWORD, email="jonathan@example.test"):
    return api_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
        headers={"User-Agent": "pytest-browser/1.0"},
    )


def test_a_successful_sign_in_is_logged_with_request_context(
    api_client, member, log
) -> None:
    response = login(api_client)
    assert response.status_code == 204

    [event] = log.events("auth.login")
    assert event["outcome"] == "success"
    assert event["user_id"] == str(member.id)
    assert event["recognised_device"] is False
    assert event["ip"] == "testclient"
    assert event["user_agent"] == "pytest-browser/1.0"
    assert event["request_id"] == response.headers["X-Request-ID"]


def test_failures_log_a_pseudonym_never_the_email_or_password(
    api_client, member, log
) -> None:
    for _ in range(5):
        login(api_client, password="wrong password guess")
    login(api_client, password=PASSWORD)  # now throttled

    failures = log.events("auth.login")
    assert [e["outcome"] for e in failures] == ["failure"] * 5 + ["throttled"]
    assert failures[0]["email_hash"] == email_hash("jonathan@example.test")
    throttled = [r for r in log.records if getattr(r, "security", {}) is failures[-1]]
    assert throttled[0].levelno == logging.WARNING
    rendered = log.rendered()
    for secret in ("jonathan@example.test", "wrong password guess", PASSWORD):
        assert secret not in rendered


def test_refresh_token_reuse_raises_a_warning(api_client, member, log) -> None:
    assert login(api_client).status_code == 204
    old_refresh = api_client.cookies.get("applytogether_refresh")
    old_csrf = api_client.cookies.get("applytogether_refresh_csrf")

    rotated = api_client.post(
        "/api/v1/auth/refresh", headers={"X-Refresh-CSRF-Token": old_csrf or ""}
    )
    assert rotated.status_code == 204

    api_client.cookies.set("applytogether_refresh", old_refresh, path="/api/v1/auth")
    replay = api_client.post(
        "/api/v1/auth/refresh", headers={"X-Refresh-CSRF-Token": old_csrf or ""}
    )
    assert replay.status_code == 401

    [reuse] = log.events("auth.refresh_reuse")
    assert reuse["outcome"] == "blocked"
    assert reuse["user_id"] == str(member.id)
    warning = [r for r in log.records if getattr(r, "security", {}) is reuse][0]
    assert warning.levelno == logging.WARNING
    assert old_refresh not in log.rendered()


def test_password_changes_are_logged(api_client, member, log) -> None:
    login(api_client)
    csrf = api_client.cookies.get("applytogether_csrf") or ""
    wrong = api_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "not it", "new_password": "a brand new passphrase"},
        headers={"X-CSRF-Token": csrf},
    )
    assert wrong.status_code == 400
    right = api_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": PASSWORD, "new_password": "a brand new passphrase"},
        headers={"X-CSRF-Token": csrf},
    )
    assert right.status_code == 204

    outcomes = [e["outcome"] for e in log.events("auth.password_changed")]
    assert outcomes == ["failure", "success"]
    assert "a brand new passphrase" not in log.rendered()


def test_rate_limit_hits_are_logged(
    api_client, log, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "rate_limits_enabled", True)
    monkeypatch.setattr(settings, "rate_limit_verify_per_ip", "1/minute")
    for _ in range(2):
        api_client.post("/api/v1/auth/verify-email", json={"token": "nope"})

    [event] = log.events("rate_limit.exceeded")
    assert event["rule"] == "verify-ip"


def test_refused_access_and_workspace_changes_are_logged(
    api_client, database_session, shared_workspace, active_member, log
) -> None:
    plain = User(email="noor@example.test", display_name="Noor")
    database_session.add(plain)
    database_session.flush()
    database_session.add(
        WorkspaceMembership(
            workspace_id=shared_workspace.id,
            user_id=plain.id,
            role=MembershipRole.MEMBER,
        )
    )
    database_session.flush()
    workspace_url = f"/api/v1/workspaces/{shared_workspace.id}"

    denied = api_client.delete(workspace_url, headers={"X-User-Id": str(plain.id)})
    assert denied.status_code == 403
    [refused] = log.events("access.denied")
    assert refused["outcome"] == "workspace_owner_required"
    assert refused["path"] == workspace_url

    owner = {"X-User-Id": str(active_member.id)}
    api_client.patch(
        f"{workspace_url}/members/{plain.id}/role",
        json={"role": "admin"},
        headers=owner,
    )
    api_client.delete(f"{workspace_url}/members/{plain.id}", headers=owner)
    api_client.delete(workspace_url, headers=owner)

    assert log.events("workspace.role_changed")[0]["role"] == "admin"
    assert log.events("workspace.member_removed")[0]["user_id"] == str(plain.id)
    assert log.events("workspace.deleted")[0]["workspace_id"] == str(
        shared_workspace.id
    )


def test_request_ids_are_echoed_or_generated(api_client) -> None:
    echoed = api_client.get("/health", headers={"X-Request-ID": "trace-123"})
    assert echoed.headers["X-Request-ID"] == "trace-123"
    replaced = api_client.get("/health", headers={"X-Request-ID": "bad id\nwith junk"})
    assert replaced.headers["X-Request-ID"] != "bad id\nwith junk"
    assert len(replaced.headers["X-Request-ID"]) == 32


def test_events_render_as_one_json_object_per_line() -> None:
    record = logging.LogRecord(
        "applytogether.security", logging.WARNING, "", 0, "x", None, None
    )
    record.security = {"event": "auth.login", "outcome": "failure"}
    line = SecurityJsonFormatter().format(record)

    assert "\n" not in line
    assert json.loads(line) | {"time": "t"} == {
        "time": "t",
        "level": "warning",
        "event": "auth.login",
        "outcome": "failure",
    }
