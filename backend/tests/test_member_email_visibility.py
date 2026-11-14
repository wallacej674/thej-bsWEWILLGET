"""SEC-16: only owners and admins see (or search) other members' emails."""

import pytest

from app.core.enums import MembershipRole
from app.models.membership import WorkspaceMembership
from app.models.user import User


@pytest.fixture
def plain_member(database_session, shared_workspace) -> User:
    user = User(email="noor@example.test", display_name="Noor")
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


def members(api_client, workspace, viewer, search: str | None = None) -> dict:
    response = api_client.get(
        f"/api/v1/workspaces/{workspace.id}/members",
        params={"search": search} if search else None,
        headers={"X-User-Id": str(viewer.id)},
    )
    assert response.status_code == 200
    return {
        item["user"]["display_name"]: item["user"]["email"]
        for item in response.json()["items"]
    }


def test_owners_see_every_members_email(
    api_client, shared_workspace, active_member, plain_member
) -> None:
    assert members(api_client, shared_workspace, active_member) == {
        "Jonathan": "jonathan@example.test",
        "Noor": "noor@example.test",
    }


def test_plain_members_see_only_their_own_email(
    api_client, shared_workspace, active_member, plain_member
) -> None:
    assert members(api_client, shared_workspace, plain_member) == {
        "Jonathan": None,
        "Noor": "noor@example.test",
    }


def test_plain_members_cannot_probe_emails_by_searching(
    api_client, shared_workspace, active_member, plain_member
) -> None:
    assert members(api_client, shared_workspace, plain_member, "jonathan@") == {}
    assert members(api_client, shared_workspace, plain_member, "Jona") == {
        "Jonathan": None
    }
    assert members(api_client, shared_workspace, active_member, "noor@") == {
        "Noor": "noor@example.test"
    }
