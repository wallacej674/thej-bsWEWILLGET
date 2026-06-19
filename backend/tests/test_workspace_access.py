from app.models.user import User


def test_active_user_without_workspace_membership_cannot_list_applications(
    api_client, database_session, shared_workspace
) -> None:
    outsider = User(email="outsider@example.test", display_name="Outsider")
    database_session.add(outsider)
    database_session.flush()

    response = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/applications",
        headers={"X-User-Id": str(outsider.id)},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "workspace_access_denied"
