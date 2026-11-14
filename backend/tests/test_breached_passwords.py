"""SEC-24: passwords exposed in known breaches are refused."""

import hashlib

import httpx
import pytest

from app.api.dependencies.email_delivery import get_email_sender
from app.core import breached_passwords
from app.core.breached_passwords import (
    BREACHED_MESSAGE,
    breach_count,
    check_not_breached,
)
from app.core.passwords import hash_password
from app.core.settings import get_settings

BREACHED = "password123456"  # long enough for the length rule
SAFE = "a perfectly unremarkable passphrase"


def sha1(value: str) -> str:
    return hashlib.sha1(value.encode(), usedforsecurity=False).hexdigest().upper()


class FakeHibp:
    """Stands in for the range API, answering like the real one."""

    def __init__(self, breached: dict[str, int], fail: bool = False) -> None:
        self.breached = {sha1(password): count for password, count in breached.items()}
        self.fail = fail
        self.requests: list[tuple[str, dict]] = []

    def __call__(self, url: str, *, headers: dict, timeout: float) -> httpx.Response:
        self.requests.append((url, headers))
        if self.fail:
            raise httpx.ConnectError("unreachable")
        prefix = url.rsplit("/", 1)[-1]
        lines = [
            f"{full[5:]}:{count}"
            for full, count in self.breached.items()
            if full.startswith(prefix)
        ]
        lines.append("0123456789ABCDEF0123456789ABCDEF012:0")  # padding
        return httpx.Response(
            200, text="\r\n".join(lines), request=httpx.Request("GET", url)
        )


@pytest.fixture
def hibp(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(get_settings(), "breached_password_check_enabled", True)
    fake = FakeHibp({BREACHED: 1_234})
    monkeypatch.setattr(breached_passwords.httpx, "get", fake)
    return fake


def test_only_a_five_character_hash_prefix_leaves_the_server(hibp) -> None:
    assert breach_count(BREACHED) == 1_234
    [(url, headers)] = hibp.requests

    assert url.endswith("/range/" + sha1(BREACHED)[:5])
    assert sha1(BREACHED) not in url
    assert BREACHED not in url and BREACHED not in str(headers)
    assert headers["Add-Padding"] == "true"


def test_unbreached_and_padding_entries_count_as_safe(hibp) -> None:
    assert breach_count(SAFE) == 0
    check_not_breached(SAFE)


def test_breached_passwords_are_refused(hibp) -> None:
    with pytest.raises(ValueError, match="known data breach"):
        check_not_breached(BREACHED)


def test_an_outage_fails_open(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "breached_password_check_enabled", True)
    monkeypatch.setattr(breached_passwords.httpx, "get", FakeHibp({}, fail=True))

    assert breach_count(BREACHED) is None
    check_not_breached(BREACHED)  # allowed: the service couldn't answer


def signup(api_client, email: str, password: str):
    return api_client.post(
        "/api/v1/auth/signup",
        json={
            "display_name": "Amara",
            "email": email,
            "password": password,
            "workspace_name": "Search",
        },
    )


def test_signup_refuses_breached_and_short_passwords_for_any_email(
    api_client, active_member, hibp
) -> None:
    for email in ("new-person@example.test", active_member.email):
        breached = signup(api_client, email, BREACHED)
        assert breached.status_code == 422
        assert breached.json()["error"] == {
            "code": "password_policy_failed",
            "message": BREACHED_MESSAGE,
            "details": None,
        }
        # Formerly a 500; and an existing email used to skip the check.
        assert signup(api_client, email, "short").status_code == 422


class NoMail:
    def __init__(self) -> None:
        self.tokens: list[str] = []

    def send_verification_email(self, **_kwargs: object) -> None:
        return None

    def send_password_reset_email(self, *, recipient: str, token: str) -> None:
        self.tokens.append(token)

    def send_password_changed_notice(self, **_kwargs: object) -> None:
        return None


def test_password_changes_and_resets_refuse_breached_passwords(
    api_client, database_session, active_member, hibp
) -> None:
    current = "correct horse battery staple"
    active_member.password_hash = hash_password(current)
    database_session.flush()
    mail = NoMail()
    api_client.app.dependency_overrides[get_email_sender] = lambda: mail

    login = api_client.post(
        "/api/v1/auth/login", json={"email": active_member.email, "password": current}
    )
    assert login.status_code == 204
    change = api_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": current, "new_password": BREACHED},
        headers={"X-CSRF-Token": api_client.cookies.get("applytogether_csrf") or ""},
    )
    assert change.status_code == 422
    assert change.json()["error"]["message"] == BREACHED_MESSAGE

    api_client.post("/api/v1/auth/forgot-password", json={"email": active_member.email})
    [token] = mail.tokens
    refused = api_client.post(
        "/api/v1/auth/reset-password", json={"token": token, "password": BREACHED}
    )
    assert refused.status_code == 422
    accepted = api_client.post(
        "/api/v1/auth/reset-password", json={"token": token, "password": SAFE}
    )
    assert accepted.status_code == 200
