"""SEC-18: caps on workspaces per owner and pending invitations per workspace."""

import pytest

from app.core.settings import get_settings


@pytest.fixture
def caps(monkeypatch: pytest.MonkeyPatch):
    settings = get_settings()

    def set_caps(*, workspaces: int = 20, invitations: int = 200) -> None:
        monkeypatch.setattr(settings, "max_workspaces_per_user", workspaces)
        monkeypatch.setattr(
            settings, "max_pending_invitations_per_workspace", invitations
        )

    return set_caps


def test_one_person_can_only_own_so_many_workspaces(
    api_client, active_member, caps
) -> None:
    # The fixture member already owns one workspace.
    caps(workspaces=3)
    headers = {"X-User-Id": str(active_member.id)}
    for index in range(2):
        response = api_client.post(
            "/api/v1/workspaces", json={"name": f"Search {index}"}, headers=headers
        )
        assert response.status_code == 201

    blocked = api_client.post(
        "/api/v1/workspaces", json={"name": "One too many"}, headers=headers
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "workspace_limit_reached"
    assert "up to 3 workspaces" in blocked.json()["error"]["message"]


def test_deleted_workspaces_free_up_the_allowance(
    api_client, active_member, caps
) -> None:
    caps(workspaces=2)
    headers = {"X-User-Id": str(active_member.id)}
    created = api_client.post(
        "/api/v1/workspaces", json={"name": "Temporary"}, headers=headers
    ).json()
    assert (
        api_client.delete(
            f"/api/v1/workspaces/{created['id']}", headers=headers
        ).status_code
        == 204
    )

    again = api_client.post(
        "/api/v1/workspaces", json={"name": "Next"}, headers=headers
    )
    assert again.status_code == 201


def test_a_workspace_can_only_have_so_many_invitations_waiting(
    api_client, active_member, shared_workspace, caps
) -> None:
    caps(invitations=2)
    url = f"/api/v1/workspaces/{shared_workspace.id}/invitations"
    headers = {"X-User-Id": str(active_member.id)}
    for index in range(2):
        response = api_client.post(
            url, json={"email": f"friend{index}@example.test"}, headers=headers
        )
        assert response.status_code == 201

    blocked = api_client.post(
        url, json={"email": "friend9@example.test"}, headers=headers
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "invitation_limit_reached"
