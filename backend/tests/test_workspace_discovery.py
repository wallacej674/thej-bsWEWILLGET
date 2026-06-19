from uuid import UUID


def test_active_member_can_discover_a_shared_workspace(
    api_client, active_member, shared_workspace
) -> None:
    response = api_client.get(
        "/api/v1/workspaces",
        headers={"X-User-Id": str(active_member.id)},
    )

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "id": str(shared_workspace.id),
                "name": "ApplyTogether",
                "role": "owner",
            }
        ]
    }
    assert UUID(response.json()["items"][0]["id"]) == shared_workspace.id
