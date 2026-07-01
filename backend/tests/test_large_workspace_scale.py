"""Scale smoke test: a 1k-member workspace stays bounded and paginated.

Validates the Milestone 6 guarantees end-to-end against a large workspace: the
summary payload is bounded regardless of member count, per-member data is served
through pagination, and the dashboard's data needs are met by a small, fixed
number of requests (summary + team-accountability), not a per-member fan-out.
"""

from app.db.seed_scale import seed_large_workspace

MEMBER_COUNT = 1000
APPS_PER_MEMBER = 2


def test_large_workspace_summary_is_bounded_and_paginated(
    api_client, database_session
) -> None:
    workspace_id, owner_id = seed_large_workspace(
        database_session,
        member_count=MEMBER_COUNT,
        apps_per_member=APPS_PER_MEMBER,
    )
    headers = {"X-User-Id": str(owner_id)}

    # 1) The summary is a single request whose size is independent of members.
    summary = api_client.get(
        f"/api/v1/workspaces/{workspace_id}/applications/summary",
        headers=headers,
    )
    assert summary.status_code == 200
    summary_body = summary.json()
    assert summary_body["total_active"] == MEMBER_COUNT * APPS_PER_MEMBER
    assert "by_owner" not in summary_body
    assert len(summary_body["top_applicants"]) <= 8
    assert len(summary_body["applications_over_time"]) == 8
    assert all("total" in point for point in summary_body["applications_over_time"])

    # 2) Per-member accountability is paginated, not "return all owners".
    accountability = api_client.get(
        f"/api/v1/workspaces/{workspace_id}/applications/team-accountability",
        params={"page": 1, "page_size": 100},
        headers=headers,
    )
    assert accountability.status_code == 200
    accountability_body = accountability.json()
    assert len(accountability_body["items"]) == 100
    assert accountability_body["pagination"]["total_items"] == MEMBER_COUNT
    assert accountability_body["pagination"]["total_pages"] == 10

    # 3) Members are paginated with a stable total count.
    members = api_client.get(
        f"/api/v1/workspaces/{workspace_id}/members",
        params={"page": 2, "page_size": 50},
        headers=headers,
    )
    assert members.status_code == 200
    members_body = members.json()
    assert len(members_body["items"]) == 50
    assert members_body["member_count"] == MEMBER_COUNT
    assert members_body["pagination"]["total_items"] == MEMBER_COUNT
