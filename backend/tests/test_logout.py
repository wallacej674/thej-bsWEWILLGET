from datetime import timedelta

import pytest
from sqlalchemy import select

from app.core.auth import get_authx
from app.core.passwords import hash_password
from app.models.auth_session import AuthenticationSession

PASSWORD = "correct horse battery staple"


@pytest.mark.parametrize("access", ["expired", "missing"])
def test_logout_revokes_session_without_a_live_access_token(
    api_client, database_session, active_member, access
) -> None:
    active_member.password_hash = hash_password(PASSWORD)
    database_session.flush()
    assert (
        api_client.post(
            "/api/v1/auth/login",
            json={"email": active_member.email, "password": PASSWORD},
        ).status_code
        == 204
    )
    authx = get_authx()
    config = authx.config
    session = database_session.scalar(
        select(AuthenticationSession).where(
            AuthenticationSession.user_id == active_member.id
        )
    )
    assert session is not None
    refresh = api_client.cookies.get(config.JWT_REFRESH_COOKIE_NAME)
    csrf = api_client.cookies.get(config.JWT_REFRESH_CSRF_COOKIE_NAME)
    headers = {}
    if access == "expired":
        headers[config.JWT_ACCESS_CSRF_HEADER_NAME] = api_client.cookies.get(
            config.JWT_ACCESS_CSRF_COOKIE_NAME
        )
        expired = authx.create_access_token(
            uid=str(active_member.id),
            expiry=timedelta(minutes=-1),
            data={"sid": str(session.id)},
        )
        api_client.cookies.set(
            config.JWT_ACCESS_COOKIE_NAME,
            expired,
            domain="testserver.local",
            path=config.JWT_ACCESS_COOKIE_PATH,
        )
    else:
        api_client.cookies.delete(config.JWT_ACCESS_COOKIE_NAME)

    invalid = api_client.post("/api/v1/auth/logout", headers=headers)
    assert invalid.status_code == 403
    database_session.refresh(session)
    assert session.revoked_at is None

    response = api_client.post(
        "/api/v1/auth/logout",
        headers={**headers, config.JWT_REFRESH_CSRF_HEADER_NAME: csrf},
    )
    assert response.status_code == 204
    assert len(response.headers.get_list("set-cookie")) == 4
    database_session.refresh(session)
    assert session.revoked_at is not None

    api_client.cookies.set(config.JWT_REFRESH_COOKIE_NAME, refresh)
    response = api_client.post(
        "/api/v1/auth/refresh",
        headers={**headers, config.JWT_REFRESH_CSRF_HEADER_NAME: csrf},
    )
    assert response.status_code == 401
