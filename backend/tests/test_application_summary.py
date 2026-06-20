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


def test_workspace_member_can_view_active_application_summary(
    api_client,
    database_session,
    active_member,
    second_active_member,
    shared_workspace,
) -> None:
    today = application_today()
    previous_month = today.replace(day=1) - timedelta(days=1)
    former_member = User(email="former@example.test", display_name="Former Member")
    database_session.add(former_member)
    database_session.flush()
    database_session.add(
        WorkspaceMembership(
            workspace_id=shared_workspace.id,
            user_id=former_member.id,
            role=MembershipRole.MEMBER,
            removed_at=utc_now(),
        )
    )
    applications = [
        JobApplication(
            workspace_id=shared_workspace.id,
            owner_id=former_member.id,
            company_name="Historical",
            job_title="Retained Role",
            job_posting_url="https://jobs.example.test/summary/historical",
            normalized_job_posting_url="https://jobs.example.test/summary/historical",
            location="Remote",
            work_arrangement=WorkArrangement.REMOTE,
            employment_type=EmploymentType.FULL_TIME,
            application_date=today,
            status=ApplicationStatus.APPLIED,
        ),
        JobApplication(
            workspace_id=shared_workspace.id,
            owner_id=active_member.id,
            company_name="Acme",
            job_title="Backend Engineer",
            job_posting_url="https://jobs.example.test/summary/acme",
            normalized_job_posting_url="https://jobs.example.test/summary/acme",
            location="Remote",
            work_arrangement=WorkArrangement.REMOTE,
            employment_type=EmploymentType.FULL_TIME,
            application_date=today,
            status=ApplicationStatus.APPLIED,
        ),
        JobApplication(
            workspace_id=shared_workspace.id,
            owner_id=active_member.id,
            company_name="Beta",
            job_title="Platform Engineer",
            job_posting_url="https://jobs.example.test/summary/beta",
            normalized_job_posting_url="https://jobs.example.test/summary/beta",
            location="Chicago",
            work_arrangement=WorkArrangement.HYBRID,
            employment_type=EmploymentType.FULL_TIME,
            application_date=previous_month,
            status=ApplicationStatus.REJECTED,
        ),
        JobApplication(
            workspace_id=shared_workspace.id,
            owner_id=second_active_member.id,
            company_name="Deleted",
            job_title="Hidden Role",
            job_posting_url="https://jobs.example.test/summary/deleted",
            normalized_job_posting_url="https://jobs.example.test/summary/deleted",
            location="Remote",
            work_arrangement=WorkArrangement.REMOTE,
            employment_type=EmploymentType.CONTRACT,
            application_date=today,
            status=ApplicationStatus.CLOSED,
            deleted_at=utc_now(),
        ),
    ]
    database_session.add_all(applications)
    database_session.flush()

    response = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/summary",
        headers={"X-User-Id": str(second_active_member.id)},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total_active"] == 3
    assert body["current_month"] == 2
    assert body["recently_updated"] == 0
    assert body["by_owner"] == [
        {
            "owner": {
                "id": str(former_member.id),
                "display_name": "Former Member",
                "avatar_url": None,
            },
            "count": 1,
        },
        {
            "owner": {
                "id": str(active_member.id),
                "display_name": "Jonathan",
                "avatar_url": None,
            },
            "count": 2,
        },
        {
            "owner": {
                "id": str(second_active_member.id),
                "display_name": "Kareem",
                "avatar_url": None,
            },
            "count": 0,
        },
    ]
    assert body["status_counts"] == {
        "applied": 2,
        "rejected": 1,
        "withdrawn": 0,
        "closed": 0,
    }
    assert body["work_arrangement_counts"] == {
        "remote": 2,
        "hybrid": 1,
        "onsite": 0,
        "unknown": 0,
    }
    assert body["recent_activity"][0]["company_name"] in {
        "Historical",
        "Acme",
        "Beta",
    }
    assert body["recent_activity"][0]["action"] == "added"
    assert len(body["applications_over_time"]) == 8
