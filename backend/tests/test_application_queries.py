def test_application_list_filters_sorts_and_paginates(
    api_client, active_member, shared_workspace
) -> None:
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    headers = {"X-User-Id": str(active_member.id)}
    for company_name, job_title, status in [
        ("Acme", "Designer", "applied"),
        ("Beta", "Backend Engineer", "rejected"),
    ]:
        response = api_client.post(
            path,
            headers=headers,
            json={
                "company_name": company_name,
                "job_title": job_title,
                "job_posting_url": f"https://jobs.example.test/{company_name}",
                "location": "New York",
                "work_arrangement": "hybrid",
                "employment_type": "full_time",
                "status": status,
            },
        )
        assert response.status_code == 201

    filtered = api_client.get(
        f"{path}?search=backend&status=rejected&work_arrangement=hybrid"
        "&employment_type=full_time&sort_by=company_name&sort_order=asc",
        headers=headers,
    )
    assert filtered.status_code == 200
    assert [item["company_name"] for item in filtered.json()["items"]] == ["Beta"]

    beyond_range = api_client.get(f"{path}?page=3&page_size=1", headers=headers)
    assert beyond_range.status_code == 200
    assert beyond_range.json()["items"] == []
    assert beyond_range.json()["pagination"]["total_items"] == 2


def test_application_list_filters_by_owner(
    api_client, active_member, second_active_member, shared_workspace
) -> None:
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    for owner, company_name in [
        (active_member, "Acme"),
        (second_active_member, "Beta"),
    ]:
        response = api_client.post(
            path,
            headers={"X-User-Id": str(owner.id)},
            json={
                "company_name": company_name,
                "job_title": "Backend Engineer",
                "job_posting_url": f"https://jobs.example.test/{company_name}",
                "location": "Remote",
                "work_arrangement": "remote",
                "employment_type": "full_time",
            },
        )
        assert response.status_code == 201

    response = api_client.get(
        f"{path}?owner_id={second_active_member.id}",
        headers={"X-User-Id": str(active_member.id)},
    )

    assert response.status_code == 200
    assert [item["company_name"] for item in response.json()["items"]] == ["Beta"]
    assert response.json()["items"][0]["owner"]["id"] == str(second_active_member.id)


def test_owner_can_partially_update_an_active_application(
    api_client, active_member, shared_workspace
) -> None:
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    headers = {"X-User-Id": str(active_member.id)}
    created = api_client.post(
        path,
        headers=headers,
        json={
            "company_name": "Acme",
            "job_title": "Backend Engineer",
            "job_posting_url": "https://jobs.example.test/acme-update",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
        },
    ).json()

    response = api_client.patch(
        f"{path}/{created['id']}",
        headers=headers,
        json={"status": "rejected", "notes": "Position closed"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    assert response.json()["notes"] == "Position closed"
    assert response.json()["company_name"] == "Acme"


def test_application_update_rejects_an_invalid_job_posting_url(
    api_client, active_member, shared_workspace
) -> None:
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    headers = {"X-User-Id": str(active_member.id)}
    created = api_client.post(
        path,
        headers=headers,
        json={
            "company_name": "Acme",
            "job_title": "Backend Engineer",
            "job_posting_url": "https://jobs.example.test/acme-invalid-url",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
        },
    ).json()

    response = api_client.patch(
        f"{path}/{created['id']}",
        headers=headers,
        json={"job_posting_url": "ftp://jobs.example.test/acme"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_application_update_rejects_a_null_job_posting_url(
    api_client, active_member, shared_workspace
) -> None:
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    headers = {"X-User-Id": str(active_member.id)}
    created = api_client.post(
        path,
        headers=headers,
        json={
            "company_name": "Acme",
            "job_title": "Backend Engineer",
            "job_posting_url": "https://jobs.example.test/acme-null-url",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
        },
    ).json()

    response = api_client.patch(
        f"{path}/{created['id']}",
        headers=headers,
        json={"job_posting_url": None},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_application_update_rejects_a_null_application_date(
    api_client, active_member, shared_workspace
) -> None:
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    headers = {"X-User-Id": str(active_member.id)}
    created = api_client.post(
        path,
        headers=headers,
        json={
            "company_name": "Acme",
            "job_title": "Backend Engineer",
            "job_posting_url": "https://jobs.example.test/acme-null-date",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
        },
    ).json()

    response = api_client.patch(
        f"{path}/{created['id']}",
        headers=headers,
        json={"application_date": None},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_application_update_rejects_an_invalid_merged_salary_range(
    api_client, active_member, shared_workspace
) -> None:
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    headers = {"X-User-Id": str(active_member.id)}
    created = api_client.post(
        path,
        headers=headers,
        json={
            "company_name": "Acme",
            "job_title": "Backend Engineer",
            "job_posting_url": "https://jobs.example.test/acme-salary",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
            "salary_min": "90000.00",
            "salary_max": "100000.00",
            "salary_period": "yearly",
        },
    ).json()

    response = api_client.patch(
        f"{path}/{created['id']}",
        headers=headers,
        json={"salary_min": "110000.00"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"
