"""SEC-14: the purge job removes only data past its retention."""

from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.commands.purge import purge
from app.core.enums import ApplicationStatus, EmploymentType, WorkArrangement
from app.core.settings import get_settings
from app.models.application import JobApplication
from app.models.auth_session import AuthenticationSession
from app.models.login_throttle import LoginThrottleBucket
from app.models.pending_registration import PendingRegistration
from app.models.rate_limit import RateLimitCounter

NOW = datetime(2026, 11, 14, 12, 0, tzinfo=UTC)
DAY = timedelta(days=1)


def _session(user, *, expires: datetime, revoked: datetime | None = None):
    return AuthenticationSession(
        user_id=user.id,
        refresh_jti_hash=uuid4().hex,
        expires_at=expires,
        revoked_at=revoked,
    )


def _registration(email: str, *, expires: datetime, consumed: datetime | None = None):
    return PendingRegistration(
        email=email,
        display_name="Someone",
        password_hash="$argon2id$not-a-real-hash",
        workspace_name="Search",
        token_digest=email.ljust(64, "0")[:64],
        expires_at=expires,
        consumed_at=consumed,
    )


def _bucket(key: str, *, last_failure: datetime | None, locked: datetime | None = None):
    return LoginThrottleBucket(
        email_digest=key,
        source_digest=key,
        scope="ip",
        failures=1,
        lock_count=0,
        window_started_at=NOW - 2 * DAY,
        last_failure_at=last_failure,
        locked_until=locked,
    )


def _application(workspace, owner, slug: str, deleted: datetime | None):
    url = f"https://jobs.example.test/purge/{slug}"
    return JobApplication(
        workspace_id=workspace.id,
        owner_id=owner.id,
        company_name=slug,
        job_title="Role",
        job_posting_url=url,
        normalized_job_posting_url=url,
        location="Remote",
        work_arrangement=WorkArrangement.REMOTE,
        employment_type=EmploymentType.FULL_TIME,
        application_date=date(2026, 10, 1),
        status=ApplicationStatus.APPLIED,
        deleted_at=deleted,
    )


@pytest.fixture
def seeded(database_session, active_member, shared_workspace):
    rows = [
        _session(active_member, expires=NOW - 31 * DAY),  # gone
        _session(active_member, expires=NOW + 9 * DAY, revoked=NOW - 31 * DAY),  # gone
        _session(active_member, expires=NOW - 5 * DAY),  # kept: recently expired
        _session(active_member, expires=NOW + 9 * DAY),  # kept: live
        _registration("old@example.test", expires=NOW - 8 * DAY),  # gone
        _registration(
            "used@example.test", expires=NOW + DAY, consumed=NOW - 8 * DAY
        ),  # gone
        _registration("new@example.test", expires=NOW + DAY),  # kept
        _bucket("a" * 64, last_failure=NOW - 2 * DAY),  # gone
        _bucket("b" * 64, last_failure=NOW - 2 * DAY, locked=NOW + DAY),  # kept: locked
        _bucket("c" * 64, last_failure=NOW - timedelta(hours=1)),  # kept: recent
        RateLimitCounter(
            key_digest="d" * 64, window_start=NOW - 2 * DAY, hits=3
        ),  # gone
        RateLimitCounter(
            key_digest="d" * 64, window_start=NOW - timedelta(hours=1), hits=3
        ),
        _application(
            shared_workspace, active_member, "binned-long-ago", NOW - 40 * DAY
        ),
        _application(shared_workspace, active_member, "binned-recently", NOW - 2 * DAY),
        _application(shared_workspace, active_member, "active", None),
    ]
    database_session.add_all(rows)
    database_session.flush()
    return database_session


def test_purge_removes_only_rows_past_retention(seeded) -> None:
    removed = purge(seeded, now=NOW)

    assert removed == {
        "auth_sessions": 2,
        "pending_registrations": 2,
        "login_throttle_buckets": 1,
        "password_reset_tokens": 0,
        "rate_limit_counters": 1,
        # Off unless PURGE_DELETED_APPLICATIONS_AFTER_DAYS is set.
        "deleted_applications": 0,
    }
    emails = set(seeded.scalars(select(PendingRegistration.email)))
    assert emails == {"new@example.test"}


def test_purge_is_safe_to_run_again(seeded) -> None:
    purge(seeded, now=NOW)
    assert set(purge(seeded, now=NOW).values()) == {0}


def test_deleted_applications_are_purged_only_when_enabled(
    seeded, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "purge_deleted_applications_after_days", 30)

    assert purge(seeded, now=NOW)["deleted_applications"] == 1
    remaining = set(seeded.scalars(select(JobApplication.company_name)))
    assert {"binned-recently", "active"} <= remaining
    assert "binned-long-ago" not in remaining
