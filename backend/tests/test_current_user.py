def test_current_user_returns_safe_profile(api_client, active_member) -> None:
    response = api_client.get(
        "/api/v1/users/me",
        headers={"X-User-Id": str(active_member.id)},
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": str(active_member.id),
        "display_name": "Jonathan",
        "avatar_url": None,
    }


def test_inactive_user_is_rejected(api_client, active_member, database_session) -> None:
    active_member.is_active = False
    database_session.flush()

    response = api_client.get(
        "/api/v1/users/me",
        headers={"X-User-Id": str(active_member.id)},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "inactive_user"
