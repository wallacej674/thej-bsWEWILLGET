from datetime import timedelta

from sqlalchemy import select

from app.api.dependencies.email_delivery import get_email_sender
from app.core.time import utc_now
from app.models.pending_registration import PendingRegistration
from app.services.email_delivery import EmailDeliveryError


class RecordingEmailSender:
    def __init__(self) -> None:
        self.messages: list[tuple[str, str, str]] = []

    def send_verification_email(
        self, *, recipient: str, display_name: str, token: str
    ) -> None:
        self.messages.append((recipient, display_name, token))


class FailingEmailSender:
    def send_verification_email(
        self, *, recipient: str, display_name: str, token: str
    ) -> None:
        raise EmailDeliveryError("provider unavailable")


def test_signup_persists_pending_registration_and_sends_verification_email(
    api_client, database_session
) -> None:
    sender = RecordingEmailSender()
    api_client.app.dependency_overrides[get_email_sender] = lambda: sender

    response = api_client.post(
        "/api/v1/auth/signup",
        json={
            "display_name": "  Amara Ellis  ",
            "email": " AMARA@EXAMPLE.TEST ",
            "password": "correct horse battery staple",
            "workspace_name": "  Amara's search  ",
        },
    )

    assert response.status_code == 202, response.text
    assert response.json() == {"message": "Check your email to continue."}
    registration = database_session.scalar(
        select(PendingRegistration).where(
            PendingRegistration.email == "amara@example.test"
        )
    )
    assert registration is not None
    assert registration.display_name == "Amara Ellis"
    assert registration.workspace_name == "Amara's search"
    assert registration.password_hash != "correct horse battery staple"
    assert registration.token_digest != sender.messages[0][2]
    assert sender.messages[0][:2] == ("amara@example.test", "Amara Ellis")


def test_signup_for_existing_user_returns_generic_response_without_sending(
    api_client, active_member
) -> None:
    sender = RecordingEmailSender()
    api_client.app.dependency_overrides[get_email_sender] = lambda: sender

    response = api_client.post(
        "/api/v1/auth/signup",
        json={
            "display_name": "Someone Else",
            "email": active_member.email,
            "password": "a different secure password",
            "workspace_name": "Another workspace",
        },
    )

    assert response.status_code == 202
    assert response.json() == {"message": "Check your email to continue."}
    assert sender.messages == []


def test_verification_creates_user_and_fallback_owner_workspace(api_client) -> None:
    sender = RecordingEmailSender()
    api_client.app.dependency_overrides[get_email_sender] = lambda: sender
    password = "correct horse battery staple"
    api_client.post(
        "/api/v1/auth/signup",
        json={
            "display_name": "Amara Ellis",
            "email": "amara@example.test",
            "password": password,
            "workspace_name": "Amara's search",
        },
    )

    verification = api_client.post(
        "/api/v1/auth/verify-email",
        json={"token": sender.messages[0][2]},
    )
    login = api_client.post(
        "/api/v1/auth/login",
        json={"email": "amara@example.test", "password": password},
    )
    workspaces = api_client.get("/api/v1/workspaces")

    assert verification.status_code == 200
    assert verification.json() == {"status": "verified"}
    assert login.status_code == 204
    assert workspaces.status_code == 200
    assert workspaces.json()["items"] == [
        {
            "id": workspaces.json()["items"][0]["id"],
            "name": "Amara's search",
            "role": "owner",
        }
    ]


def test_verification_preserves_invitation_and_creates_fallback_workspace(
    api_client, active_member, shared_workspace
) -> None:
    invited_email = "invited@example.test"
    invitation = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers={"X-User-Id": str(active_member.id)},
        json={"email": invited_email},
    )
    assert invitation.status_code == 201

    sender = RecordingEmailSender()
    api_client.app.dependency_overrides[get_email_sender] = lambda: sender
    password = "correct horse battery staple"
    api_client.post(
        "/api/v1/auth/signup",
        json={
            "display_name": "Mina Okafor",
            "email": invited_email,
            "password": password,
            "workspace_name": "Should not be created",
        },
    )
    api_client.post(
        "/api/v1/auth/verify-email",
        json={"token": sender.messages[0][2]},
    )
    api_client.post(
        "/api/v1/auth/login",
        json={"email": invited_email, "password": password},
    )

    workspaces = api_client.get("/api/v1/workspaces")
    inbox = api_client.get("/api/v1/invitations")

    assert workspaces.status_code == 200
    assert workspaces.json()["items"] == [
        {
            "id": workspaces.json()["items"][0]["id"],
            "name": "Should not be created",
            "role": "owner",
        }
    ]
    assert inbox.status_code == 200
    assert inbox.json()["items"][0]["workspace"] == {
        "id": str(shared_workspace.id),
        "name": "ApplyTogether",
    }


def test_failed_signup_delivery_is_saved_and_can_be_resent_immediately(
    api_client, database_session
) -> None:
    api_client.app.dependency_overrides[get_email_sender] = FailingEmailSender
    email = "retry@example.test"

    signup = api_client.post(
        "/api/v1/auth/signup",
        json={
            "display_name": "Inez Park",
            "email": email,
            "password": "correct horse battery staple",
            "workspace_name": "Inez search",
        },
    )
    registration = database_session.scalar(
        select(PendingRegistration).where(PendingRegistration.email == email)
    )

    sender = RecordingEmailSender()
    api_client.app.dependency_overrides[get_email_sender] = lambda: sender
    resend = api_client.post(
        "/api/v1/auth/resend-verification",
        json={"email": email},
    )

    assert signup.status_code == 503
    assert signup.json()["error"]["code"] == "email_delivery_unavailable"
    assert registration is not None
    assert resend.status_code == 202
    assert resend.json() == {
        "message": "If an account is pending, a new link was sent."
    }
    assert sender.messages[0][0] == email


def test_repeated_signup_does_not_replace_live_registration(api_client) -> None:
    sender = RecordingEmailSender()
    api_client.app.dependency_overrides[get_email_sender] = lambda: sender
    email = "stable@example.test"
    original_password = "correct horse battery staple"
    api_client.post(
        "/api/v1/auth/signup",
        json={
            "display_name": "Leila Morgan",
            "email": email,
            "password": original_password,
            "workspace_name": "Original workspace",
        },
    )
    original_token = sender.messages[0][2]

    repeated = api_client.post(
        "/api/v1/auth/signup",
        json={
            "display_name": "Replacement Name",
            "email": email,
            "password": "replacement secure password",
            "workspace_name": "Replacement workspace",
        },
    )
    api_client.post("/api/v1/auth/verify-email", json={"token": original_token})
    login = api_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": original_password},
    )
    workspaces = api_client.get("/api/v1/workspaces")

    assert repeated.status_code == 202
    assert len(sender.messages) == 1
    assert login.status_code == 204
    assert workspaces.json()["items"][0]["name"] == "Original workspace"


def test_invalid_and_expired_verification_links_share_the_same_error(
    api_client, database_session
) -> None:
    invalid = api_client.post(
        "/api/v1/auth/verify-email",
        json={"token": "not-a-real-token"},
    )

    sender = RecordingEmailSender()
    api_client.app.dependency_overrides[get_email_sender] = lambda: sender
    email = "expired@example.test"
    api_client.post(
        "/api/v1/auth/signup",
        json={
            "display_name": "Nadia Chen",
            "email": email,
            "password": "correct horse battery staple",
            "workspace_name": "Nadia search",
        },
    )
    registration = database_session.scalar(
        select(PendingRegistration).where(PendingRegistration.email == email)
    )
    assert registration is not None
    registration.expires_at = utc_now() - timedelta(seconds=1)
    database_session.commit()

    expired = api_client.post(
        "/api/v1/auth/verify-email",
        json={"token": sender.messages[0][2]},
    )

    assert invalid.status_code == 400
    assert expired.status_code == 400
    assert invalid.json()["error"]["code"] == "verification_link_invalid"
    assert expired.json()["error"]["code"] == "verification_link_invalid"


def test_consumed_verification_link_is_idempotent(api_client) -> None:
    sender = RecordingEmailSender()
    api_client.app.dependency_overrides[get_email_sender] = lambda: sender
    api_client.post(
        "/api/v1/auth/signup",
        json={
            "display_name": "Elian Brooks",
            "email": "elian@example.test",
            "password": "correct horse battery staple",
            "workspace_name": "Elian search",
        },
    )
    token = sender.messages[0][2]

    first = api_client.post("/api/v1/auth/verify-email", json={"token": token})
    second = api_client.post("/api/v1/auth/verify-email", json={"token": token})

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == {"status": "verified"}


def test_resend_cooldown_and_unknown_email_keep_generic_response(api_client) -> None:
    sender = RecordingEmailSender()
    api_client.app.dependency_overrides[get_email_sender] = lambda: sender
    email = "cooldown@example.test"
    api_client.post(
        "/api/v1/auth/signup",
        json={
            "display_name": "Sora Alvarez",
            "email": email,
            "password": "correct horse battery staple",
            "workspace_name": "Sora search",
        },
    )

    cooldown = api_client.post(
        "/api/v1/auth/resend-verification",
        json={"email": email},
    )
    unknown = api_client.post(
        "/api/v1/auth/resend-verification",
        json={"email": "unknown@example.test"},
    )

    assert cooldown.status_code == 202
    assert unknown.status_code == 202
    assert cooldown.json() == unknown.json()
    assert len(sender.messages) == 1


def test_resend_does_not_email_an_active_account(
    api_client, database_session, active_member
) -> None:
    sender = RecordingEmailSender()
    api_client.app.dependency_overrides[get_email_sender] = lambda: sender
    database_session.add(
        PendingRegistration(
            email=active_member.email,
            display_name=active_member.display_name,
            password_hash="not-used",
            workspace_name="Not used",
            token_digest="a" * 64,
            expires_at=utc_now() + timedelta(hours=1),
        )
    )
    database_session.commit()

    response = api_client.post(
        "/api/v1/auth/resend-verification",
        json={"email": active_member.email},
    )

    assert response.status_code == 202
    assert sender.messages == []
