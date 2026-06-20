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


def test_workspace_owner_can_moderate_another_members_application(
    api_client,
    database_session,
    active_member,
    shared_workspace,
) -> None:
    from app.core.enums import MembershipRole
    from app.models.membership import WorkspaceMembership
    from app.models.user import User

    member = User(email="member@example.test", display_name="Member")
    database_session.add(member)
    database_session.flush()
    database_session.add(
        WorkspaceMembership(
            workspace_id=shared_workspace.id,
            user_id=member.id,
            role=MembershipRole.MEMBER,
        )
    )
    database_session.flush()
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    created = api_client.post(
        path,
        headers={"X-User-Id": str(member.id)},
        json={
            "company_name": "Off-topic Company",
            "job_title": "Unfit Role",
            "job_posting_url": "https://jobs.example.test/openings/moderation",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
        },
    ).json()

    response = api_client.delete(
        f"{path}/{created['id']}",
        headers={"X-User-Id": str(active_member.id)},
    )

    assert response.status_code == 204
    owner_deleted = api_client.get(
        f"{path}/deleted",
        headers={"X-User-Id": str(active_member.id)},
    )
    member_deleted = api_client.get(
        f"{path}/deleted",
        headers={"X-User-Id": str(member.id)},
    )
    assert owner_deleted.json()["items"][0]["id"] == created["id"]
    assert owner_deleted.json()["items"][0]["deleted_by"]["id"] == str(active_member.id)
    assert owner_deleted.json()["items"][0]["moderated"] is True
    assert member_deleted.json()["items"] == []

    restore_by_author = api_client.post(
        f"{path}/{created['id']}/restore",
        headers={"X-User-Id": str(member.id)},
    )
    assert restore_by_author.status_code == 403
    assert restore_by_author.json()["error"]["code"] == "application_restore_forbidden"

    restore_by_deleter = api_client.post(
        f"{path}/{created['id']}/restore",
        headers={"X-User-Id": str(active_member.id)},
    )
    assert restore_by_deleter.status_code == 200


def test_general_member_cannot_delete_another_members_application(
    api_client,
    database_session,
    active_member,
    shared_workspace,
) -> None:
    from app.core.enums import MembershipRole
    from app.models.membership import WorkspaceMembership
    from app.models.user import User

    member = User(email="general-member@example.test", display_name="General Member")
    database_session.add(member)
    database_session.flush()
    database_session.add(
        WorkspaceMembership(
            workspace_id=shared_workspace.id,
            user_id=member.id,
            role=MembershipRole.MEMBER,
        )
    )
    database_session.flush()
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    created = api_client.post(
        path,
        headers={"X-User-Id": str(active_member.id)},
        json={
            "company_name": "Example Company",
            "job_title": "Owned Role",
            "job_posting_url": "https://jobs.example.test/openings/member-forbidden",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
        },
    ).json()

    response = api_client.delete(
        f"{path}/{created['id']}",
        headers={"X-User-Id": str(member.id)},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "application_delete_forbidden"


def test_workspace_admin_can_moderate_another_members_application(
    api_client, database_session, active_member, shared_workspace
) -> None:
    from app.core.enums import MembershipRole
    from app.models.membership import WorkspaceMembership
    from app.models.user import User

    admin = User(email="admin@example.test", display_name="Admin")
    author = User(email="author@example.test", display_name="Author")
    database_session.add_all([admin, author])
    database_session.flush()
    database_session.add_all(
        [
            WorkspaceMembership(
                workspace_id=shared_workspace.id,
                user_id=admin.id,
                role=MembershipRole.ADMIN,
            ),
            WorkspaceMembership(
                workspace_id=shared_workspace.id,
                user_id=author.id,
                role=MembershipRole.MEMBER,
            ),
        ]
    )
    database_session.flush()
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    created = api_client.post(
        path,
        headers={"X-User-Id": str(author.id)},
        json={
            "company_name": "Unrelated Company",
            "job_title": "Unrelated Role",
            "job_posting_url": "https://jobs.example.test/openings/admin-moderation",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
        },
    ).json()

    response = api_client.delete(
        f"{path}/{created['id']}",
        headers={"X-User-Id": str(admin.id)},
    )

    assert response.status_code == 204
    admin_trash = api_client.get(
        f"{path}/deleted",
        headers={"X-User-Id": str(admin.id)},
    ).json()
    assert admin_trash["items"][0]["id"] == created["id"]


def test_member_can_permanently_delete_selected_self_deleted_applications(
    api_client, database_session, active_member, shared_workspace
) -> None:
    from app.core.enums import MembershipRole
    from app.models.membership import WorkspaceMembership
    from app.models.user import User

    member = User(email="purge-member@example.test", display_name="Purge Member")
    database_session.add(member)
    database_session.flush()
    database_session.add(
        WorkspaceMembership(
            workspace_id=shared_workspace.id,
            user_id=member.id,
            role=MembershipRole.MEMBER,
        )
    )
    database_session.flush()
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    headers = {"X-User-Id": str(member.id)}
    created = api_client.post(
        path,
        headers=headers,
        json={
            "company_name": "Delete Forever",
            "job_title": "Selected Role",
            "job_posting_url": "https://jobs.example.test/openings/delete-forever",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
        },
    ).json()
    assert (
        api_client.delete(f"{path}/{created['id']}", headers=headers).status_code == 204
    )

    response = api_client.post(
        f"{path}/deleted/permanent-delete",
        headers=headers,
        json={"application_ids": [created["id"]], "delete_all": False},
    )

    assert response.status_code == 200
    assert response.json() == {"deleted_count": 1}
    assert api_client.get(f"{path}/deleted", headers=headers).json()["items"] == []


def test_select_all_permanently_deletes_only_the_current_users_trash(
    api_client, active_member, second_active_member, shared_workspace
) -> None:
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    owner_headers = {"X-User-Id": str(active_member.id)}
    other_headers = {"X-User-Id": str(second_active_member.id)}
    application_ids = []
    for index, headers in enumerate((owner_headers, other_headers), start=1):
        created = api_client.post(
            path,
            headers=headers,
            json={
                "company_name": f"Delete All {index}",
                "job_title": f"Role {index}",
                "job_posting_url": (
                    f"https://jobs.example.test/openings/delete-all-{index}"
                ),
                "location": "Remote",
                "work_arrangement": "remote",
                "employment_type": "full_time",
            },
        ).json()
        application_ids.append(created["id"])
        assert (
            api_client.delete(
                f"{path}/{created['id']}",
                headers=headers,
            ).status_code
            == 204
        )

    response = api_client.post(
        f"{path}/deleted/permanent-delete",
        headers=owner_headers,
        json={"application_ids": [], "delete_all": True},
    )

    assert response.status_code == 200
    assert response.json() == {"deleted_count": 1}
    assert (
        api_client.get(f"{path}/deleted", headers=owner_headers).json()["items"] == []
    )
    other_trash = api_client.get(f"{path}/deleted", headers=other_headers).json()
    assert other_trash["pagination"]["total_items"] == 1


def test_member_select_all_permanently_deletes_only_their_eligible_trash(
    api_client, database_session, active_member, shared_workspace
) -> None:
    from app.core.enums import MembershipRole
    from app.models.membership import WorkspaceMembership
    from app.models.user import User

    member = User(email="select-all-member@example.test", display_name="Select All")
    database_session.add(member)
    database_session.flush()
    database_session.add(
        WorkspaceMembership(
            workspace_id=shared_workspace.id,
            user_id=member.id,
            role=MembershipRole.MEMBER,
        )
    )
    database_session.flush()
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    owner_headers = {"X-User-Id": str(active_member.id)}
    member_headers = {"X-User-Id": str(member.id)}
    for index, headers in enumerate((owner_headers, member_headers), start=1):
        created = api_client.post(
            path,
            headers=headers,
            json={
                "company_name": f"Scoped Trash {index}",
                "job_title": f"Role {index}",
                "job_posting_url": (
                    f"https://jobs.example.test/openings/scoped-trash-{index}"
                ),
                "location": "Remote",
                "work_arrangement": "remote",
                "employment_type": "full_time",
            },
        ).json()
        assert (
            api_client.delete(f"{path}/{created['id']}", headers=headers).status_code
            == 204
        )

    response = api_client.post(
        f"{path}/deleted/permanent-delete",
        headers=member_headers,
        json={"application_ids": [], "delete_all": True},
    )

    assert response.status_code == 200
    assert response.json() == {"deleted_count": 1}
    owner_trash = api_client.get(f"{path}/deleted", headers=owner_headers).json()
    assert owner_trash["pagination"]["total_items"] == 1


def test_member_cannot_permanently_delete_another_users_trash(
    api_client, database_session, active_member, shared_workspace
) -> None:
    from app.core.enums import MembershipRole
    from app.models.membership import WorkspaceMembership
    from app.models.user import User

    member = User(email="malicious-member@example.test", display_name="Member")
    database_session.add(member)
    database_session.flush()
    database_session.add(
        WorkspaceMembership(
            workspace_id=shared_workspace.id,
            user_id=member.id,
            role=MembershipRole.MEMBER,
        )
    )
    database_session.flush()
    path = f"/api/v1/workspaces/{shared_workspace.id}/applications"
    owner_headers = {"X-User-Id": str(active_member.id)}
    created = api_client.post(
        path,
        headers=owner_headers,
        json={
            "company_name": "Protected Trash",
            "job_title": "Owner Role",
            "job_posting_url": "https://jobs.example.test/openings/protected-trash",
            "location": "Remote",
            "work_arrangement": "remote",
            "employment_type": "full_time",
        },
    ).json()
    assert (
        api_client.delete(f"{path}/{created['id']}", headers=owner_headers).status_code
        == 204
    )

    response = api_client.post(
        f"{path}/deleted/permanent-delete",
        headers={"X-User-Id": str(member.id)},
        json={"application_ids": [created["id"]], "delete_all": False},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "permanent_delete_forbidden"
