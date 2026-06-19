def test_active_member_can_create_an_owned_application(
    api_client, active_member, shared_workspace
) -> None:
    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications",
        headers={"X-User-Id": str(active_member.id)},
        json={
            "company_name": "Example Company",
            "job_title": "Backend Engineer",
            "job_posting_url": "https://jobs.example.test/openings/123?ref=career-site",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["company_name"] == "Example Company"
    assert body["status"] == "applied"
    assert body["owner"] == {
        "id": str(active_member.id),
        "display_name": "Jonathan",
        "avatar_url": None,
    }


def test_application_creation_rejects_an_invalid_salary_currency_code(
    api_client, active_member, shared_workspace
) -> None:
    response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications",
        headers={"X-User-Id": str(active_member.id)},
        json={
            "company_name": "Example Company",
            "job_title": "Backend Engineer",
            "job_posting_url": "https://jobs.example.test/openings/invalid-currency",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
            "salary_min": "100000.00",
            "salary_period": "yearly",
            "salary_currency": "US1",
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
