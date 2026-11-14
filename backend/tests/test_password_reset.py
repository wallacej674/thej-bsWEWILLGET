"""SEC-10: a secure forgot-password flow."""

from datetime import timedelta

import pytest
from sqlalchemy import update

from app.api.dependencies.email_delivery import get_email_sender
from app.core.passwords import hash_password
from app.core.settings import get_settings
from app.core.time import utc_now
from app.models.password_reset import PasswordResetToken

OLD = "correct horse battery staple"
NEW = "a brand new passphrase"
EMAIL = "jonathan@example.test"


class RecordingEmailSender:
    def __init__(self) -> None:
        self.reset_tokens: list[str] = []
        self.changed_notices: list[str] = []

    def send_verification_email(self, **_kwargs: object) -> None:
        return None

    def send_login_paused_notice(self, **_kwargs: object) -> None:
        return None

    def send_password_reset_email(self, *, recipient: str, token: str) -> None:
        assert recipient == EMAIL
        self.reset_tokens.append(token)

    def send_password_changed_notice(self, *, recipient: str) -> None:
        self.changed_notices.append(recipient)


@pytest.fixture
def mail(api_client):
    sender = RecordingEmailSender()
    api_client.app.dependency_overrides[get_email_sender] = lambda: sender
    return sender


@pytest.fixture
def member(database_session, active_member):
    active_member.password_hash = hash_password(OLD)
    database_session.flush()
    return active_member


def forgot(api_client, email=EMAIL):
    return api_client.post("/api/v1/auth/forgot-password", json={"email": email})


def reset(api_client, token, password=NEW):
    return api_client.post(
        "/api/v1/auth/reset-password", json={"token": token, "password": password}
    )


def login(api_client, password):
    return api_client.post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": password}
    )


def test_a_reset_link_sets_a_new_password(api_client, member, mail) -> None:
    response = forgot(api_client)
    assert response.status_code == 202
    [token] = mail.reset_tokens

    assert reset(api_client, token).status_code == 200
    assert mail.changed_notices == [EMAIL]
    assert login(api_client, OLD).status_code == 401
    assert login(api_client, NEW).status_code == 204


def test_unknown_emails_get_the_same_answer_and_no_email(
    api_client, member, mail
) -> None:
    known = forgot(api_client)
    unknown = forgot(api_client, "nobody@example.test")

    assert unknown.status_code == known.status_code == 202
    assert unknown.json() == known.json()
    assert len(mail.reset_tokens) == 1


def test_a_link_works_only_once(api_client, member, mail) -> None:
    forgot(api_client)
    [token] = mail.reset_tokens
    assert reset(api_client, token).status_code == 200

    again = reset(api_client, token, password="yet another passphrase")
    assert again.status_code == 400
    assert again.json()["error"]["code"] == "reset_link_invalid"


def test_expired_links_are_refused(api_client, database_session, member, mail) -> None:
    forgot(api_client)
    [token] = mail.reset_tokens
    database_session.execute(
        update(PasswordResetToken).values(expires_at=utc_now() - timedelta(minutes=1))
    )
    database_session.flush()

    assert reset(api_client, token).status_code == 400


def test_asking_again_invalidates_the_earlier_link(api_client, member, mail) -> None:
    forgot(api_client)
    forgot(api_client)
    first, second = mail.reset_tokens

    assert reset(api_client, first).status_code == 400
    assert reset(api_client, second).status_code == 200


def test_the_password_policy_applies_and_a_rejected_try_keeps_the_link(
    api_client, member, mail
) -> None:
    forgot(api_client)
    [token] = mail.reset_tokens

    short = reset(api_client, token, password="short")
    assert short.status_code == 422
    assert short.json()["error"]["code"] == "password_policy_failed"
    assert reset(api_client, token).status_code == 200


def test_a_reset_signs_out_every_existing_session(api_client, member, mail) -> None:
    assert login(api_client, OLD).status_code == 204
    assert api_client.get("/api/v1/users/me").status_code == 200

    forgot(api_client)
    reset(api_client, mail.reset_tokens[0])

    assert api_client.get("/api/v1/users/me").status_code == 401


def test_asking_for_links_is_rate_limited(
    api_client, member, mail, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "rate_limits_enabled", True)
    monkeypatch.setattr(settings, "rate_limit_forgot_password_per_email", "1/hour")

    assert forgot(api_client).status_code == 202
    assert forgot(api_client).status_code == 429
