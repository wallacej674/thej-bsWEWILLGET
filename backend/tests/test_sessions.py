from app.core.auth import get_authx


def test_session_list_and_revocation_are_scoped_to_the_signed_in_user(
    api_client, database_session, active_member, second_active_member
) -> None:
    from app.core.passwords import hash_password
    from app.services.auth_service import AuthenticationService

    password = "correct horse battery staple"
    hashed = hash_password(password)
    active_member.password_hash = hashed
    second_active_member.password_hash = hashed
    database_session.flush()
    auth = AuthenticationService()

    old = auth.login(database_session, email=active_member.email, password=password)
    other = auth.login(
        database_session, email=second_active_member.email, password=password
    )
    database_session.commit()
    assert (
        api_client.post(
            "/api/v1/auth/login",
            json={"email": active_member.email, "password": password},
            headers={"User-Agent": "Session Test Browser"},
        ).status_code
        == 204
    )
    config = get_authx().config
    headers = {
        config.JWT_ACCESS_CSRF_HEADER_NAME: api_client.cookies.get(
            config.JWT_ACCESS_CSRF_COOKIE_NAME
        )
    }
    list_path = "/api/v1/auth/sessions"
    sessions = api_client.get(list_path).json()
    assert len(sessions) == 2
    current = next(item for item in sessions if item["current"])
    assert current["user_agent"] == "Session Test Browser"
    assert "refresh_jti_hash" not in current
    assert {item["id"] for item in sessions} == {current["id"], str(old.session.id)}
    assert (
        api_client.delete(
            f"{list_path}/{other.session.id}", headers=headers
        ).status_code
        == 404
    )
    assert api_client.delete(f"{list_path}/others", headers=headers).status_code == 204
    assert [item["id"] for item in api_client.get(list_path).json()] == [current["id"]]

    api_client.cookies.clear()
    api_client.cookies.set(config.JWT_ACCESS_COOKIE_NAME, old.access_token)
    assert api_client.get("/api/v1/users/me").status_code == 401
    api_client.cookies.set(config.JWT_ACCESS_COOKIE_NAME, other.access_token)
    assert api_client.get("/api/v1/users/me").status_code == 200
