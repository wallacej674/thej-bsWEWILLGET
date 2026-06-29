from datetime import timedelta

from app.core.enums import (
    ApplicationStatus,
    EmploymentType,
    MembershipRole,
    WorkArrangement,
)
from app.core.time import application_today, utc_now
from app.models.application import JobApplication
from app.models.membership import WorkspaceMembership
from app.models.user import User


def _application(
    workspace_id, owner_id, *, slug, status, application_date, deleted=False
):
    url = f"https://jobs.example.test/accountability/{slug}"
    return JobApplication(
        workspace_id=workspace_id,
        owner_id=owner_id,
        company_name=f"Company {slug}",
        job_title=f"Role {slug}",
        job_posting_url=url,
        normalized_job_posting_url=url,
        location="Remote",
        work_arrangement=WorkArrangement.REMOTE,
        employment_type=EmploymentType.FULL_TIME,
        application_date=application_date,
        status=status,
        deleted_at=utc_now() if deleted else None,
    )


def _seed(database_session, shared_workspace, active_member, second_active_member):
    today = application_today()
    older = today - timedelta(days=30)
    # A member with no applications still appears (membership = visibility).
    quiet = User(email="quiet@example.test", display_name="Quiet Member")
    database_session.add(quiet)
    database_session.flush()
    database_session.add(
        WorkspaceMembership(
            workspace_id=shared_workspace.id,
            user_id=quiet.id,
            role=MembershipRole.MEMBER,
        )
    )
    database_session.add_all(
        [
            _application(
                shared_workspace.id,
                active_member.id,
                slug="a-week",
                status=ApplicationStatus.APPLIED,
                application_date=today,
            ),
            _application(
                shared_workspace.id,
                active_member.id,
                slug="a-old",
                status=ApplicationStatus.REJECTED,
                application_date=older,
            ),
            _application(
                shared_workspace.id,
                active_member.id,
                slug="a-old2",
                status=ApplicationStatus.APPLIED,
                application_date=older,
            ),
            _application(
                shared_workspace.id,
                active_member.id,
                slug="a-deleted",
                status=ApplicationStatus.APPLIED,
                application_date=today,
                deleted=True,
            ),
            _application(
                shared_workspace.id,
                second_active_member.id,
                slug="b-old",
                status=ApplicationStatus.APPLIED,
                application_date=older,
            ),
        ]
    )
    database_session.flush()
    return quiet, today, older


def test_team_accountability_groups_per_owner(
    api_client, database_session, active_member, second_active_member, shared_workspace
) -> None:
    quiet, today, older = _seed(
        database_session, shared_workspace, active_member, second_active_member
    )

    response = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/team-accountability",
        headers={"X-User-Id": str(active_member.id)},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["pagination"] == {
        "page": 1,
        "page_size": 20,
        "total_items": 3,
        "total_pages": 1,
    }
    rows = {row["owner"]["id"]: row for row in body["items"]}
    assert rows[str(active_member.id)] == {
        "owner": {
            "id": str(active_member.id),
            "display_name": "Jonathan",
            "avatar_url": None,
        },
        "active": 3,
        "this_week": 1,
        "rejected": 1,
        "last_applied": today.isoformat(),
    }
    assert rows[str(second_active_member.id)]["active"] == 1
    assert rows[str(second_active_member.id)]["this_week"] == 0
    assert rows[str(second_active_member.id)]["last_applied"] == older.isoformat()
    # The quiet member has no applications but is still visible with zeros.
    assert rows[str(quiet.id)]["active"] == 0
    assert rows[str(quiet.id)]["last_applied"] is None
    # Default sort is most-active first.
    assert body["items"][0]["owner"]["id"] == str(active_member.id)


def test_team_accountability_pagination_and_sort(
    api_client, database_session, active_member, second_active_member, shared_workspace
) -> None:
    _seed(database_session, shared_workspace, active_member, second_active_member)

    page_one = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/team-accountability",
        params={"sort": "name", "order": "asc", "page": 1, "page_size": 1},
        headers={"X-User-Id": str(active_member.id)},
    ).json()
    page_two = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/team-accountability",
        params={"sort": "name", "order": "asc", "page": 2, "page_size": 1},
        headers={"X-User-Id": str(active_member.id)},
    ).json()

    assert page_one["pagination"]["total_items"] == 3
    assert page_one["pagination"]["total_pages"] == 3
    assert len(page_one["items"]) == 1
    # Sorted by display name ascending: Jonathan, Kareem, Quiet Member.
    assert page_one["items"][0]["owner"]["display_name"] == "Jonathan"
    assert page_two["items"][0]["owner"]["display_name"] == "Kareem"


def test_team_accountability_rejects_oversized_page_size(
    api_client, active_member, shared_workspace
) -> None:
    response = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/team-accountability",
        params={"page_size": 500},
        headers={"X-User-Id": str(active_member.id)},
    )
    assert response.status_code == 422


def test_team_accountability_requires_membership(
    api_client, database_session, shared_workspace
) -> None:
    outsider = User(email="outsider@example.test", display_name="Outsider")
    database_session.add(outsider)
    database_session.flush()

    response = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/team-accountability",
        headers={"X-User-Id": str(outsider.id)},
    )
    assert response.status_code == 403
