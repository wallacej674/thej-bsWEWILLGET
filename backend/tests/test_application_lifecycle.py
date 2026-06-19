def test_only_the_owner_can_change_and_restore_an_application(
    api_client, active_member, second_active_member, shared_workspace
) -> None:
    create_response = api_client.post(
        f"/api/v1/workspaces/{shared_workspace.id}/applications",
        headers={"X-User-Id": str(active_member.id)},
        json={
            "company_name": "Example Company",
            "job_title": "Backend Engineer",
            "job_posting_url": "https://jobs.example.test/openings/789",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
        },
    )
    application_id = create_response.json()["id"]
    application_path = (
        f"/api/v1/workspaces/{shared_workspace.id}/applications/{application_id}"
    )

    forbidden_update = api_client.patch(
        application_path,
        headers={"X-User-Id": str(second_active_member.id)},
        json={"notes": "Not the owner"},
    )
    assert forbidden_update.status_code == 403
    assert forbidden_update.json()["error"]["code"] == "application_ownership_required"

    assert (
        api_client.delete(
            application_path,
            headers={"X-User-Id": str(active_member.id)},
        ).status_code
        == 204
    )
    assert (
        api_client.get(
            application_path,
            headers={"X-User-Id": str(active_member.id)},
        ).status_code
        == 404
    )

    other_trash = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/deleted",
        headers={"X-User-Id": str(second_active_member.id)},
    )
    assert other_trash.json()["items"] == []

    restore_response = api_client.post(
        f"{application_path}/restore",
        headers={"X-User-Id": str(active_member.id)},
    )
    assert restore_response.status_code == 200
    assert (
        api_client.get(
            application_path,
            headers={"X-User-Id": str(active_member.id)},
        ).status_code
        == 200
    )


def test_owner_must_restore_a_deleted_duplicate_posting(
    api_client, active_member, shared_workspace
) -> None:
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    headers = {"X-User-Id": str(active_member.id)}
    created = api_client.post(
        path,
        headers=headers,
        json={
            "company_name": "Example Company",
            "job_title": "Backend Engineer",
            "job_posting_url": "https://jobs.example.test/openings/duplicate?utm_source=mail",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
        },
    ).json()

    delete_response = api_client.delete(f"{path}/{created['id']}", headers=headers)
    duplicate_response = api_client.post(
        path,
        headers=headers,
        json={
            "company_name": "Example Company",
            "job_title": "Backend Engineer",
            "job_posting_url": "https://jobs.example.test/openings/duplicate",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
        },
    )

    assert delete_response.status_code == 204
    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["error"]["code"] == "deleted_application_exists"


def test_owner_can_list_their_deleted_applications(
    api_client, active_member, shared_workspace
) -> None:
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    headers = {"X-User-Id": str(active_member.id)}
    created = api_client.post(
        path,
        headers=headers,
        json={
            "company_name": "Example Company",
            "job_title": "Backend Engineer",
            "job_posting_url": "https://jobs.example.test/openings/deleted-list",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
        },
    ).json()

    delete_response = api_client.delete(f"{path}/{created['id']}", headers=headers)
    deleted_response = api_client.get(
        f"{path}/deleted?page=1&page_size=1", headers=headers
    )

    assert delete_response.status_code == 204
    assert deleted_response.status_code == 200
    assert deleted_response.json()["pagination"] == {
        "page": 1,
        "page_size": 1,
        "total_items": 1,
        "total_pages": 1,
    }
    assert deleted_response.json()["items"][0]["id"] == created["id"]
    assert deleted_response.json()["items"][0]["deleted_at"] is not None
