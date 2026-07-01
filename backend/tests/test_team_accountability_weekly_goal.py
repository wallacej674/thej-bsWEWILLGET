def test_team_accountability_includes_each_members_weekly_goal(
    api_client, database_session, active_member, second_active_member, shared_workspace
) -> None:
    # One member sets a goal; the other leaves it unset.
    set_response = api_client.patch(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/weekly-goal",
        headers={"X-User-Id": str(active_member.id)},
        json={"weekly_goal": 7},
    )
    assert set_response.status_code == 200, set_response.text

    response = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/team-accountability",
        headers={"X-User-Id": str(active_member.id)},
    )
    assert response.status_code == 200, response.text
    rows = {row["owner"]["id"]: row for row in response.json()["items"]}

    assert rows[str(active_member.id)]["weekly_goal"] == 7
    assert rows[str(second_active_member.id)]["weekly_goal"] is None
