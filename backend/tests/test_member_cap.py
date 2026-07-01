from app.core.enums import MembershipRole
from app.core.settings import get_settings
from app.models.invitation import WorkspaceInvitation
from app.models.membership import WorkspaceMembership
from app.models.user import User


def test_invite_is_blocked_when_member_cap_is_reached(
    api_client, monkeypatch, active_member, shared_workspace
) -> None:
    # Owner alone already meets a cap of one.
    monkeypatch.setattr(get_settings(), "workspace_member_cap", 1)

    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/invitations",
        json={"email": "newcomer@example.test"},
        headers={"X-User-Id": str(active_member.id)},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "workspace_member_cap_reached"


def test_accept_is_blocked_when_member_cap_is_reached(
    api_client, database_session, monkeypatch, active_member, shared_workspace
) -> None:
    # Fill the workspace to a cap of two: owner plus one direct member.
    filler = User(email="filler@example.test", display_name="Filler")
    database_session.add(filler)
    database_session.flush()
    database_session.add(
        WorkspaceMembership(
            workspace_id=shared_workspace.id,
            user_id=filler.id,
            role=MembershipRole.MEMBER,
        )
    )
    guest = User(email="guest@example.test", display_name="Guest")
    database_session.add(guest)
    database_session.flush()
    invitation = WorkspaceInvitation(
        workspace_id=shared_workspace.id,
        email=guest.email,
        invited_by_user_id=active_member.id,
    )
    database_session.add(invitation)
    database_session.flush()

    monkeypatch.setattr(get_settings(), "workspace_member_cap", 2)

    response = api_client.post(
        f"/api/v1/invitations/{invitation.id}/accept",
        headers={"X-User-Id": str(guest.id)},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "workspace_member_cap_reached"
