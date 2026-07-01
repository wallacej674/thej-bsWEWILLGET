from app.core.enums import MembershipRole
from app.models.membership import WorkspaceMembership
from app.models.user import User


def _add_member(database_session, shared_workspace, *, name, email):
    user = User(email=email, display_name=name)
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


def test_members_are_paginated_with_member_count(
    api_client, database_session, active_member, shared_workspace
) -> None:
    for index in range(5):
        _add_member(
            database_session,
            shared_workspace,
            name=f"Teammate {index:02d}",
            email=f"teammate{index}@example.test",
        )

    response = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/members",
        params={"page": 1, "page_size": 2},
        headers={"X-User-Id": str(active_member.id)},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 2
    assert body["pagination"] == {
        "page": 1,
        "page_size": 2,
        "total_items": 6,
        "total_pages": 3,
    }
    # Six active members total (owner + five teammates).
    assert body["member_count"] == 6


def test_members_search_filters_but_member_count_is_total(
    api_client, database_session, active_member, shared_workspace
) -> None:
    _add_member(
        database_session,
        shared_workspace,
        name="Searchable Person",
        email="findme@example.test",
    )
    _add_member(
        database_session,
        shared_workspace,
        name="Someone Else",
        email="other@example.test",
    )

    response = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/members",
        params={"search": "findme"},
        headers={"X-User-Id": str(active_member.id)},
    )

    assert response.status_code == 200
    body = response.json()
    assert [item["user"]["email"] for item in body["items"]] == ["findme@example.test"]
    assert body["pagination"]["total_items"] == 1
    # member_count ignores the search filter so the roster total stays stable.
    assert body["member_count"] == 3


def test_members_reject_oversized_page_size(
    api_client, active_member, shared_workspace
) -> None:
    response = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/members",
        params={"page_size": 101},
        headers={"X-User-Id": str(active_member.id)},
    )
    assert response.status_code == 422
