from datetime import date, timedelta

from app.core.enums import ApplicationStatus, EmploymentType, WorkArrangement
from app.core.time import application_today
from app.models.application import JobApplication


def _week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def test_incomplete_current_week_preserves_the_full_completed_week_streak(
    api_client, database_session, active_member, shared_workspace
) -> None:
    goal_response = api_client.patch(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/weekly-goal",
        headers={"X-User-Id": str(active_member.id)},
        json={"weekly_goal": 1},
    )
    assert goal_response.status_code == 200

    this_week = _week_start(application_today())
    for offset in range(1, 28):
        application_date = this_week - timedelta(weeks=offset)
        url = f"https://jobs.example.test/long-streak/{offset}"
        database_session.add(
            JobApplication(
                workspace_id=shared_workspace.id,
                owner_id=active_member.id,
                company_name=f"Company {offset}",
                job_title=f"Role {offset}",
                job_posting_url=url,
                normalized_job_posting_url=url,
                location="Remote",
                work_arrangement=WorkArrangement.REMOTE,
                employment_type=EmploymentType.FULL_TIME,
                application_date=application_date,
                status=ApplicationStatus.APPLIED,
            )
        )
    database_session.flush()

    response = api_client.get(
        f"/api/v1/workspaces/{shared_workspace.id}/applications/my-week",
        headers={"X-User-Id": str(active_member.id)},
    )

    assert response.status_code == 200
    assert response.json()["streak_weeks"] == 27
