def test_active_members_can_view_shared_active_applications(
    api_client, active_member, second_active_member, shared_workspace
) -> None:
    create_response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications",
        headers={"X-User-Id": str(active_member.id)},
        json={
            "company_name": "Example Company",
            "job_title": "Backend Engineer",
            "job_posting_url": "https://jobs.example.test/openings/456",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
        },
    )
    assert create_response.status_code == 201

    response = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/applications",
        headers={"X-User-Id": str(second_active_member.id)},
    )

    assert response.status_code == 200
    assert response.json()["pagination"] == {
        "page": 1,
        "page_size": 20,
        "total_items": 1,
        "total_pages": 1,
    }
    assert response.json()["items"][0]["owner"]["id"] == str(active_member.id)
