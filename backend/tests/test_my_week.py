from datetime import date, timedelta

from app.core.enums import ApplicationStatus, EmploymentType, WorkArrangement
from app.core.time import application_today
from app.models.application import JobApplication
from app.models.user import User
from app.models.workspace import Workspace


def _make_application(
    workspace: Workspace,
    owner: User,
    *,
    application_date: date,
    status: ApplicationStatus = ApplicationStatus.APPLIED,
    slug: str | None = None,
) -> JobApplication:
    key = slug or application_date.isoformat()
    url = f"https://jobs.example.test/my-week/{owner.id}/{key}"
    return JobApplication(
        workspace_id=workspace.id,
        owner_id=owner.id,
        company_name=f"Company {key}",
        job_title=f"Role {key}",
        job_posting_url=url,
        normalized_job_posting_url=url,
        location="Remote",
        work_arrangement=WorkArrangement.REMOTE,
        employment_type=EmploymentType.FULL_TIME,
        application_date=application_date,
        status=status,
    )


def _my_week(api_client, workspace: Workspace, user: User) -> dict:
    response = api_client.get(
        f"/api/v1/workspaces/{workspace.id}/applications/my-week",
        headers={"X-User-Id": str(user.id)},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _set_goal(api_client, workspace: Workspace, user: User, goal: int):
    return api_client.patch(
        f"/api/v1/workspaces/{workspace.id}/applications/weekly-goal",
        headers={"X-User-Id": str(user.id)},
        json={"weekly_goal": goal},
    )


def _week_start(reference: date) -> date:
    return reference - timedelta(days=reference.weekday())


def test_my_week_reports_this_week_count_and_unset_goal(
    api_client, database_session, active_member, shared_workspace
) -> None:
    database_session.add(
        _make_application(shared_workspace, active_member, application_date=application_today())
    )
    database_session.flush()

    body = _my_week(api_client, shared_workspace, active_member)

    assert body["weekly_goal"] is None
    assert body["applied_this_week"] == 1
    assert body["streak_weeks"] == 0
    assert body["day_streak"] == 1


def test_setting_weekly_goal_persists_and_is_reflected(
    api_client, database_session, active_member, shared_workspace
) -> None:
    response = _set_goal(api_client, shared_workspace, active_member, 4)
    assert response.status_code == 200, response.text
    assert response.json()["weekly_goal"] == 4

    # A fresh read sees the saved goal.
    assert _my_week(api_client, shared_workspace, active_member)["weekly_goal"] == 4


def test_invalid_weekly_goal_is_rejected(
    api_client, database_session, active_member, shared_workspace
) -> None:
    assert (
        _set_goal(api_client, shared_workspace, active_member, 0).status_code == 422
    )


def test_streak_is_one_when_only_current_week_meets_goal(
    api_client, database_session, active_member, shared_workspace
) -> None:
    _set_goal(api_client, shared_workspace, active_member, 2)
    today = application_today()
    database_session.add_all(
        [
            _make_application(shared_workspace, active_member, application_date=today, slug="a"),
            _make_application(shared_workspace, active_member, application_date=today, slug="b"),
        ]
    )
    database_session.flush()

    assert _my_week(api_client, shared_workspace, active_member)["streak_weeks"] == 1


def test_incomplete_current_week_does_not_break_prior_streak(
    api_client, database_session, active_member, shared_workspace
) -> None:
    _set_goal(api_client, shared_workspace, active_member, 2)
    this_week = _week_start(application_today())
    last_week = this_week - timedelta(days=7)
    two_weeks_ago = this_week - timedelta(days=14)
    database_session.add_all(
        [
            # Current week is below goal (in progress) — must not reset the streak.
            _make_application(shared_workspace, active_member, application_date=application_today(), slug="now"),
            _make_application(shared_workspace, active_member, application_date=last_week, slug="l1"),
            _make_application(shared_workspace, active_member, application_date=last_week, slug="l2"),
            _make_application(shared_workspace, active_member, application_date=two_weeks_ago, slug="t1"),
            _make_application(shared_workspace, active_member, application_date=two_weeks_ago, slug="t2"),
        ]
    )
    database_session.flush()

    assert _my_week(api_client, shared_workspace, active_member)["streak_weeks"] == 2


def test_missed_week_stops_the_streak(
    api_client, database_session, active_member, shared_workspace
) -> None:
    _set_goal(api_client, shared_workspace, active_member, 2)
    this_week = _week_start(application_today())
    last_week = this_week - timedelta(days=7)
    two_weeks_ago = this_week - timedelta(days=14)
    three_weeks_ago = this_week - timedelta(days=21)
    database_session.add_all(
        [
            _make_application(shared_workspace, active_member, application_date=last_week, slug="l1"),
            _make_application(shared_workspace, active_member, application_date=last_week, slug="l2"),
            # Two weeks ago missed the goal (only one) — the streak stops here.
            _make_application(shared_workspace, active_member, application_date=two_weeks_ago, slug="t1"),
            _make_application(shared_workspace, active_member, application_date=three_weeks_ago, slug="x1"),
            _make_application(shared_workspace, active_member, application_date=three_weeks_ago, slug="x2"),
        ]
    )
    database_session.flush()

    assert _my_week(api_client, shared_workspace, active_member)["streak_weeks"] == 1


def test_day_streak_counts_back_from_today_and_stops_at_a_gap(
    api_client, database_session, active_member, shared_workspace
) -> None:
    today = application_today()
    database_session.add_all(
        [
            _make_application(shared_workspace, active_member, application_date=today, slug="d0"),
            # Skip yesterday; the day two back is present but the gap stops the run.
            _make_application(shared_workspace, active_member, application_date=today - timedelta(days=2), slug="d2"),
        ]
    )
    database_session.flush()

    assert _my_week(api_client, shared_workspace, active_member)["day_streak"] == 1


def test_day_streak_survives_an_empty_today(
    api_client, database_session, active_member, shared_workspace
) -> None:
    today = application_today()
    database_session.add_all(
        [
            _make_application(shared_workspace, active_member, application_date=today - timedelta(days=1), slug="y"),
            _make_application(shared_workspace, active_member, application_date=today - timedelta(days=2), slug="yy"),
        ]
    )
    database_session.flush()

    assert _my_week(api_client, shared_workspace, active_member)["day_streak"] == 2


def test_oldest_open_returns_oldest_applied_and_ignores_closed(
    api_client, database_session, active_member, shared_workspace
) -> None:
    today = application_today()
    database_session.add_all(
        [
            _make_application(
                shared_workspace, active_member,
                application_date=today - timedelta(days=20), slug="old",
            ),
            _make_application(
                shared_workspace, active_member,
                application_date=today - timedelta(days=40),
                status=ApplicationStatus.REJECTED, slug="rej",
            ),
        ]
    )
    database_session.flush()

    oldest = _my_week(api_client, shared_workspace, active_member)["oldest_open"]
    assert oldest is not None
    assert oldest["company_name"] == "Company old"


def test_oldest_open_is_null_without_open_applications(
    api_client, database_session, active_member, shared_workspace
) -> None:
    database_session.add(
        _make_application(
            shared_workspace, active_member,
            application_date=application_today(),
            status=ApplicationStatus.WITHDRAWN, slug="w",
        )
    )
    database_session.flush()

    assert _my_week(api_client, shared_workspace, active_member)["oldest_open"] is None
