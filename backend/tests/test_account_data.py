from datetime import timedelta

from sqlalchemy import select

from app.core.auth import get_authx
from app.core.device_cookie import DEVICE_COOKIE_NAME
from app.core.passwords import hash_password
from app.core.time import utc_now
from app.models.application import JobApplication
from app.models.auth_session import AuthenticationSession
from app.models.password_reset import PasswordResetToken
from app.models.resume import UserResume
from tests.test_ai_resume_tailor import create_application

PASSWORD = "correct horse battery staple"


def login(api_client, database_session, user):
    user.password_hash = hash_password(PASSWORD)
    database_session.flush()
    assert (
        api_client.post(
            "/api/v1/auth/login", json={"email": user.email, "password": PASSWORD}
        ).status_code
        == 204
    )
    config = get_authx().config
    return {
        config.JWT_ACCESS_CSRF_HEADER_NAME: api_client.cookies.get(
            config.JWT_ACCESS_CSRF_COOKIE_NAME
        )
    }


def test_account_export_only_contains_requesters_data(
    api_client, database_session, active_member, second_active_member, shared_workspace
) -> None:
    own = create_application(api_client, shared_workspace.id, active_member.id)
    create_application(api_client, shared_workspace.id, second_active_member.id)
    database_session.add(
        UserResume(
            user_id=active_member.id,
            original_filename="own.pdf",
            extracted_text="Full resume " * 300,
            parser_status="readable",
        )
    )
    database_session.flush()
    login(api_client, database_session, active_member)
    response = api_client.get("/api/v1/users/me/export")
    assert response.status_code == 200
    data = response.json()
    assert [app["id"] for app in data["applications"]] == [own["id"]]
    assert "password_hash" not in data
    assert data["resume"]["text"] == "Full resume " * 300


def test_sole_owner_and_wrong_password_block_account_deletion(
    api_client, database_session, active_member
) -> None:
    headers = login(api_client, database_session, active_member)
    response = api_client.request(
        "DELETE", "/api/v1/users/me", json={"password": "wrong"}, headers=headers
    )
    assert response.status_code == 400
    response = api_client.request(
        "DELETE", "/api/v1/users/me", json={"password": PASSWORD}, headers=headers
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "account_sole_workspace_owner"
    workspace_id = response.json()["error"]["details"]["workspace_id"]
    assert (
        api_client.delete(
            f"/api/v1/workspaces/{workspace_id}", headers=headers
        ).status_code
        == 204
    )
    assert api_client.get("/api/v1/workspaces").json() == {"items": []}
    response = api_client.request(
        "DELETE", "/api/v1/users/me", json={"password": PASSWORD}, headers=headers
    )
    assert response.status_code == 204


def test_account_deletion_clears_private_data_and_anonymizes_shared_history(
    api_client, database_session, active_member, second_active_member, shared_workspace
) -> None:
    application = create_application(
        api_client,
        shared_workspace.id,
        active_member.id,
        notes="personal notes",
        job_posting_url="https://jobs.example.test/opening?candidate=jonathan@example.test",
    )
    database_session.add(
        UserResume(
            user_id=active_member.id,
            original_filename="own.pdf",
            extracted_text="private text",
            parser_status="readable",
        )
    )
    database_session.flush()
    headers = login(api_client, database_session, active_member)
    access_cookie = get_authx().config.JWT_ACCESS_COOKIE_NAME
    original_access = api_client.cookies.get(access_cookie)
    database_session.add(
        PasswordResetToken(
            user_id=active_member.id,
            token_digest="a" * 64,
            expires_at=utc_now() + timedelta(minutes=30),
        )
    )
    database_session.flush()
    assert api_client.cookies.get(DEVICE_COOKIE_NAME) is not None
    response = api_client.request(
        "DELETE", "/api/v1/users/me", json={"password": PASSWORD}, headers=headers
    )
    assert response.status_code == 204
    assert api_client.cookies.get(DEVICE_COOKIE_NAME) is None
    assert (
        database_session.scalar(
            select(PasswordResetToken).where(
                PasswordResetToken.user_id == active_member.id
            )
        )
        is None
    )
    database_session.refresh(active_member)
    assert not active_member.is_active
    assert active_member.display_name == "Deleted account"
    assert active_member.password_hash is None
    assert (
        database_session.scalar(
            select(UserResume).where(UserResume.user_id == active_member.id)
        )
        is None
    )
    assert (
        database_session.scalar(
            select(AuthenticationSession).where(
                AuthenticationSession.user_id == active_member.id
            )
        )
        is None
    )
    assert (
        database_session.scalar(
            select(JobApplication.notes).where(JobApplication.id == application["id"])
        )
        is None
    )
    urls = database_session.execute(
        select(
            JobApplication.job_posting_url, JobApplication.normalized_job_posting_url
        ).where(JobApplication.id == application["id"])
    ).one()
    assert all(url.startswith("https://deleted.invalid/") for url in urls)
    api_client.cookies.set(access_cookie, original_access)
    assert api_client.get("/api/v1/users/me").status_code == 401
