from app.core.enums import MembershipRole
from app.models.membership import WorkspaceMembership
from app.models.user import User


def _add_member(database_session, shared_workspace, *, name: str = "Member") -> User:
    user = User(
        email=f"{name.lower()}@example.test",
        display_name=name,
    )
    database_session.add(user)
    database_session.flush()
    database_session.add(
        WorkspaceMembership(
            workspace_id=shared_workspace.id,
            user_id=user.id,
            role=MembershipRole.MEMBER,
        )
    )
    database_session.flush()
    return user


def test_workspace_members_include_identity_and_role(
    api_client, database_session, active_member, shared_workspace
) -> None:
    member = _add_member(database_session, shared_workspace, name="Taylor")

    response = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/members",
        headers={"X-User-Id": str(active_member.id)},
    )

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "user": {
                    "id": str(active_member.id),
                    "display_name": "Jonathan",
                    "email": "jonathan@example.test",
                    "avatar_url": None,
                },
                "role": "owner",
                "joined_at": response.json()["items"][0]["joined_at"],
            },
            {
                "user": {
                    "id": str(member.id),
                    "display_name": "Taylor",
                    "email": "taylor@example.test",
                    "avatar_url": None,
                },
                "role": "member",
                "joined_at": response.json()["items"][1]["joined_at"],
            },
        ]
    }


def test_owner_can_remove_a_member_and_member_loses_workspace_access(
    api_client, database_session, active_member, shared_workspace
) -> None:
    member = _add_member(database_session, shared_workspace)
    member_headers = {"X-User-Id": str(member.id)}

    response = api_client.delete(
        f"/api/v1/workspaces/{shared_workspace.id}/members/{member.id}",
        headers={"X-User-Id": str(active_member.id)},
    )

    assert response.status_code == 204
    denied = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/applications",
        headers=member_headers,
    )
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "workspace_access_denied"


def test_member_cannot_remove_members_and_owner_cannot_remove_an_owner(
    api_client,
    database_session,
    active_member,
    second_active_member,
    shared_workspace,
) -> None:
    member = _add_member(database_session, shared_workspace)

    forbidden = api_client.delete(
        f"/api/v1/workspaces/{shared_workspace.id}/members/{active_member.id}",
        headers={"X-User-Id": str(member.id)},
    )
    owner_removal = api_client.delete(
        f"/api/v1/workspaces/{shared_workspace.id}/members/{second_active_member.id}",
        headers={"X-User-Id": str(active_member.id)},
    )

    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "workspace_owner_required"
    assert owner_removal.status_code == 409
    assert (
        owner_removal.json()["error"]["code"] == "workspace_owner_removal_not_supported"
    )


def test_owner_can_soft_delete_workspace_and_members_lose_access(
    api_client, active_member, second_active_member, shared_workspace
) -> None:
    response = api_client.delete(
        f"/api/v1/workspaces/{shared_workspace.id}",
        headers={"X-User-Id": str(active_member.id)},
    )

    assert response.status_code == 204
    assert api_client.get(
        "/api/v1/workspaces",
        headers={"X-User-Id": str(active_member.id)},
    ).json() == {"items": []}
    denied = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/applications",
        headers={"X-User-Id": str(second_active_member.id)},
    )
    assert denied.status_code == 404
    assert denied.json()["error"]["code"] == "workspace_not_found"


def test_member_cannot_delete_workspace(
    api_client, database_session, active_member, shared_workspace
) -> None:
    member = _add_member(database_session, shared_workspace)

    response = api_client.delete(
        f"/api/v1/workspaces/{shared_workspace.id}",
        headers={"X-User-Id": str(member.id)},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "workspace_owner_required"


def test_user_can_create_a_workspace_and_becomes_its_owner(
    api_client, active_member, shared_workspace
) -> None:
    response = api_client.post(
        "/api/v1/workspaces",
        headers={"X-User-Id": str(active_member.id)},
        json={"name": "Finance Search"},
    )

    assert response.status_code == 201, response.json()
    created = response.json()
    assert created["name"] == "Finance Search"
    assert created["role"] == "owner"
    workspaces = api_client.get(
        "/api/v1/workspaces",
        headers={"X-User-Id": str(active_member.id)},
    ).json()["items"]
    assert {workspace["name"] for workspace in workspaces} == {
        "ApplyTogether",
        "Finance Search",
    }


def test_owner_can_invite_an_existing_user_as_a_member(
    api_client, database_session, active_member, shared_workspace
) -> None:
    guest = User(email="guest@example.test", display_name="Guest")
    database_session.add(guest)
    database_session.flush()

    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers={"X-User-Id": str(active_member.id)},
        json={"email": guest.email},
    )

    assert response.status_code == 201
    assert response.json()["email"] == "guest@example.test"
    assert response.json()["status"] == "joined"
    assert response.json()["role"] == "member"

    workspace = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}",
        headers={"X-User-Id": str(guest.id)},
    )
    assert workspace.status_code == 200
    assert workspace.json()["role"] == "member"


def test_unknown_guest_email_remains_a_visible_pending_invitation(
    api_client, active_member, shared_workspace
) -> None:
    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers={"X-User-Id": str(active_member.id)},
        json={"email": "future.guest@example.test"},
    )
    pending = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers={"X-User-Id": str(active_member.id)},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "pending"
    assert pending.status_code == 200
    assert pending.json()["items"][0]["email"] == "future.guest@example.test"
    assert pending.json()["items"][0]["status"] == "pending"


def test_general_member_cannot_invite_workspace_guests(
    api_client, database_session, active_member, shared_workspace
) -> None:
    member = _add_member(database_session, shared_workspace, name="Inviter")

    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers={"X-User-Id": str(member.id)},
        json={"email": "guest@example.test"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "workspace_owner_required"


def test_pending_invitation_is_claimed_when_the_guest_account_exists(
    api_client, database_session, active_member, shared_workspace
) -> None:
    email = "onboarded.guest@example.test"
    invite = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers={"X-User-Id": str(active_member.id)},
        json={"email": email},
    )
    guest = User(email=email, display_name="Onboarded Guest")
    database_session.add(guest)
    database_session.flush()

    workspaces = api_client.get(
        "/api/v1/workspaces",
        headers={"X-User-Id": str(guest.id)},
    )

    assert invite.json()["status"] == "pending"
    assert workspaces.status_code == 200
    assert workspaces.json()["items"] == [
        {
            "id": str(shared_workspace.id),
            "name": "ApplyTogether",
            "role": "member",
        }
    ]


def test_owner_can_promote_a_member_to_admin_and_return_them_to_member(
    api_client, database_session, active_member, shared_workspace
) -> None:
    member = _add_member(database_session, shared_workspace, name="Moderator")
    path = f"/api/v1/workspaces/{shared_workspace.id}/members/{member.id}/role"
    headers = {"X-User-Id": str(active_member.id)}

    promoted = api_client.patch(path, headers=headers, json={"role": "admin"})
    demoted = api_client.patch(path, headers=headers, json={"role": "member"})

    assert promoted.status_code == 200
    assert promoted.json()["role"] == "admin"
    assert demoted.status_code == 200
    assert demoted.json()["role"] == "member"


def test_admin_cannot_manage_members_invites_or_delete_workspace(
    api_client, database_session, active_member, shared_workspace
) -> None:
    admin = _add_member(database_session, shared_workspace, name="Admin")
    target = _add_member(database_session, shared_workspace, name="Target")
    promote_path = f"/api/v1/workspaces/{shared_workspace.id}/members/{admin.id}/role"
    owner_headers = {"X-User-Id": str(active_member.id)}
    admin_headers = {"X-User-Id": str(admin.id)}
    assert (
        api_client.patch(
            promote_path,
            headers=owner_headers,
            json={"role": "admin"},
        ).status_code
        == 200
    )

    remove = api_client.delete(
        f"/api/v1/workspaces/{shared_workspace.id}/members/{target.id}",
        headers=admin_headers,
    )
    invite = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        headers=admin_headers,
        json={"email": "another.guest@example.test"},
    )
    delete_workspace = api_client.delete(
        f"/api/v1/workspaces/{shared_workspace.id}",
        headers=admin_headers,
    )

    assert remove.status_code == 403
    assert invite.status_code == 403
    assert delete_workspace.status_code == 403
    assert remove.json()["error"]["code"] == "workspace_owner_required"
    assert invite.json()["error"]["code"] == "workspace_owner_required"
    assert delete_workspace.json()["error"]["code"] == "workspace_owner_required"
