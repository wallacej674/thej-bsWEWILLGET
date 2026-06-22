from app.models.user import User


def test_invited_user_sees_pending_invitation_with_inviter_display_name(
    api_client, database_session, active_member, shared_workspace
) -> None:
    guest = User(email="guest@example.test", display_name="Guest")
    database_session.add(guest)
    database_session.flush()

    created = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers={"X-User-Id": str(active_member.id)},
        json={"email": guest.email},
    )
    inbox = api_client.get(
        "/api/v1/invitations",
        headers={"X-User-Id": str(guest.id)},
    )
    workspace = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}",
        headers={"X-User-Id": str(guest.id)},
    )

    assert created.status_code == 201
    assert created.json()["status"] == "pending"
    assert inbox.status_code == 200
    assert inbox.json()["items"] == [
        {
            "id": created.json()["id"],
            "workspace": {
                "id": str(shared_workspace.id),
                "name": "ApplyTogether",
            },
            "invited_by": {"display_name": active_member.display_name},
            "invited_at": created.json()["invited_at"],
        }
    ]
    assert workspace.status_code == 404


def test_invited_user_can_accept_workspace_invitation(
    api_client, database_session, active_member, shared_workspace
) -> None:
    guest = User(email="accepting@example.test", display_name="Accepting Guest")
    database_session.add(guest)
    database_session.flush()
    invitation = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers={"X-User-Id": str(active_member.id)},
        json={"email": guest.email},
    ).json()

    accepted = api_client.post(
        f"/api/v1/invitations/{invitation['id']}/accept",
        headers={"X-User-Id": str(guest.id)},
    )
    inbox = api_client.get(
        "/api/v1/invitations",
        headers={"X-User-Id": str(guest.id)},
    )
    owner_pending = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers={"X-User-Id": str(active_member.id)},
    )

    assert accepted.status_code == 200
    assert accepted.json() == {
        "id": str(shared_workspace.id),
        "name": "ApplyTogether",
        "role": "member",
    }
    assert inbox.json()["items"] == []
    assert owner_pending.json()["items"] == []


def test_invited_user_can_decline_workspace_invitation(
    api_client, database_session, active_member, shared_workspace
) -> None:
    guest = User(email="declining@example.test", display_name="Declining Guest")
    database_session.add(guest)
    database_session.flush()
    invitation = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers={"X-User-Id": str(active_member.id)},
        json={"email": guest.email},
    ).json()

    declined = api_client.post(
        f"/api/v1/invitations/{invitation['id']}/decline",
        headers={"X-User-Id": str(guest.id)},
    )
    inbox = api_client.get(
        "/api/v1/invitations",
        headers={"X-User-Id": str(guest.id)},
    )
    workspace = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}",
        headers={"X-User-Id": str(guest.id)},
    )
    owner_pending = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers={"X-User-Id": str(active_member.id)},
    )

    assert declined.status_code == 204
    assert inbox.json()["items"] == []
    assert workspace.status_code == 404
    assert owner_pending.json()["items"] == []


def test_invitation_cannot_be_answered_by_a_different_email(
    api_client, active_member, second_active_member, shared_workspace
) -> None:
    invitation = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers={"X-User-Id": str(active_member.id)},
        json={"email": "intended@example.test"},
    ).json()

    response = api_client.post(
        f"/api/v1/invitations/{invitation['id']}/accept",
        headers={"X-User-Id": str(second_active_member.id)},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "workspace_invitation_not_found"


def test_owner_can_revoke_a_pending_workspace_invitation(
    api_client, active_member, shared_workspace
) -> None:
    headers = {"X-User-Id": str(active_member.id)}
    invitation = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers=headers,
        json={"email": "wrong-address@example.test"},
    ).json()

    revoked = api_client.delete(
        (f"/api/v1/workspaces/{shared_workspace.id}/invitations/{invitation['id']}"),
        headers=headers,
    )
    pending = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers=headers,
    )
    reinvited = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers=headers,
        json={"email": "wrong-address@example.test"},
    )

    assert revoked.status_code == 204
    assert pending.json()["items"] == []
    assert reinvited.status_code == 201
