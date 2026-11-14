"""SEC-03: sign-in throttling that a stranger can't use to lock someone out."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies.email_delivery import get_email_sender
from app.core.device_cookie import (
    DEVICE_COOKIE_NAME,
    DeviceClaim,
    issue_device_cookie,
    read_device_cookie,
)
from app.core.passwords import hash_password
from app.models.login_throttle import LoginThrottleBucket
from app.services import auth_service, login_throttle
from app.services.auth_service import AuthenticationService, InvalidCredentialsError
from app.services.login_throttle import (
    LoginThrottledError,
    count_failure,
    lock_duration,
)

EMAIL = "jonathan@example.test"
PASSWORD = "correct horse battery staple"
WRONG = "not the right password"
ATTACKER = "198.51.100.66"
OWNER = "192.0.2.10"
T0 = datetime(2026, 11, 13, 12, 0, tzinfo=UTC)


class Clock:
    def __init__(self) -> None:
        self.now = T0

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **delta: float) -> None:
        self.now += timedelta(**delta)


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> Clock:
    fake = Clock()
    monkeypatch.setattr(login_throttle, "utc_now", fake)
    monkeypatch.setattr(auth_service, "utc_now", fake)
    return fake


@pytest.fixture
def member(database_session, active_member):
    active_member.password_hash = hash_password(PASSWORD)
    database_session.flush()
    return active_member


def sign_in(session, password=PASSWORD, ip=OWNER, device=None, email=EMAIL):
    return AuthenticationService().login(
        session, email=email, password=password, client_ip=ip, device=device
    )


def fail(session, ip=ATTACKER, device=None, email=EMAIL) -> InvalidCredentialsError:
    with pytest.raises(InvalidCredentialsError) as caught:
        sign_in(session, password=WRONG, ip=ip, device=device, email=email)
    return caught.value


def throttled(session, password=WRONG, ip=ATTACKER, device=None, email=EMAIL):
    with pytest.raises(LoginThrottledError) as caught:
        sign_in(session, password=password, ip=ip, device=device, email=email)
    return caught.value


def test_an_attacker_on_one_ip_cannot_lock_the_owner_out(
    database_session, member, clock
) -> None:
    for _ in range(5):
        fail(database_session)

    # The attacker's IP now has to wait, even with the right password...
    error = throttled(database_session, password=PASSWORD)
    assert error.retry_after_seconds == 60
    for _ in range(15):
        throttled(database_session)

    # ...but the owner, on their own connection, signs straight in.
    assert sign_in(database_session, ip=OWNER).user.id == member.id


def test_guessing_spread_across_ips_pauses_only_unrecognised_devices(
    database_session, member, clock
) -> None:
    for index in range(19):
        assert fail(database_session, ip=f"203.0.113.{index}").notify_user is None
    tripped = fail(database_session, ip="203.0.113.99")

    # The 20th failure pauses unrecognised devices and tells the owner.
    assert tripped.notify_user is not None
    assert tripped.notify_user.id == member.id
    assert tripped.paused_for_seconds == 60
    throttled(database_session, password=PASSWORD, ip="192.0.2.200")

    # A browser the owner has signed in from before still works.
    laptop = DeviceClaim(user_id=member.id, device_id="owners-laptop")
    result = sign_in(database_session, ip="192.0.2.200", device=laptop)
    assert result.trusted_device

    # A device cookie for some other account doesn't count as recognised.
    stranger = DeviceClaim(user_id=uuid4(), device_id="someone-else")
    throttled(database_session, password=PASSWORD, ip="192.0.2.200", device=stranger)


def test_the_owner_is_emailed_at_most_once_a_day(
    database_session, member, clock
) -> None:
    for index in range(20):
        last = fail(database_session, ip=f"203.0.113.{index}")
    assert last.notify_user is not None

    clock.advance(minutes=2)
    for index in range(20):
        again = fail(database_session, ip=f"203.0.114.{index}")
    assert again.notify_user is None
    assert again.paused_for_seconds == 0

    clock.advance(hours=25)
    for index in range(20):
        later = fail(database_session, ip=f"203.0.115.{index}")
    assert later.notify_user is not None


def test_unknown_emails_are_throttled_exactly_like_real_ones(
    database_session, member, clock
) -> None:
    for _ in range(5):
        fail(database_session, email="nobody@example.test")
    error = throttled(database_session, email="nobody@example.test")
    assert error.retry_after_seconds == 60


def test_a_successful_sign_in_clears_that_source(
    database_session, member, clock
) -> None:
    for _ in range(4):
        fail(database_session, ip=OWNER)
    sign_in(database_session, ip=OWNER)
    for _ in range(4):
        fail(database_session, ip=OWNER)

    assert sign_in(database_session, ip=OWNER).user.id == member.id


def test_failures_outside_the_window_are_forgotten(
    database_session, member, clock
) -> None:
    for _ in range(4):
        fail(database_session)
    clock.advance(minutes=16)
    for _ in range(4):
        fail(database_session)

    assert sign_in(database_session, ip=ATTACKER).user.id == member.id


def test_an_administrator_reset_lifts_the_throttle(
    database_session, member, clock
) -> None:
    for _ in range(5):
        fail(database_session)
    throttled(database_session, password=PASSWORD)

    AuthenticationService().reset_password(
        database_session, user=member, password="a brand new passphrase"
    )

    result = sign_in(database_session, password="a brand new passphrase", ip=ATTACKER)
    assert result.user.id == member.id


def bucket() -> LoginThrottleBucket:
    return LoginThrottleBucket(
        email_digest="e",
        source_digest="s",
        scope="ip",
        failures=0,
        lock_count=0,
        window_started_at=T0,
    )


def test_locks_double_and_a_spent_lock_starts_a_fresh_count() -> None:
    row = bucket()
    for _ in range(4):
        assert not count_failure(row, 5, T0)
    assert count_failure(row, 5, T0)
    assert row.locked_until == T0 + timedelta(seconds=60)

    # SEC-19: once the lock runs out, one more typo doesn't re-lock.
    after = T0 + timedelta(seconds=61)
    assert not count_failure(row, 5, after)
    assert row.failures == 1
    for _ in range(3):
        count_failure(row, 5, after)
    assert count_failure(row, 5, after)
    assert row.locked_until == after + timedelta(seconds=120)


def test_failures_while_locked_are_not_counted() -> None:
    row = bucket()
    for _ in range(5):
        count_failure(row, 5, T0)
    assert not count_failure(row, 5, T0 + timedelta(seconds=30))
    assert row.lock_count == 1


def test_a_quiet_day_forgets_the_lock_history() -> None:
    row = bucket()
    now = T0
    for _ in range(3):
        for _ in range(5):
            count_failure(row, 5, now)
        now = row.locked_until + timedelta(seconds=1)
    assert row.lock_count == 3

    later = now + timedelta(hours=25)
    for _ in range(5):
        count_failure(row, 5, later)
    assert row.locked_until == later + timedelta(seconds=60)


def test_lock_lengths_double_up_to_an_hour() -> None:
    assert [lock_duration(n).total_seconds() / 60 for n in range(8)] == [
        1,
        2,
        4,
        8,
        16,
        32,
        60,
        60,
    ]


def test_device_cookies_are_signed() -> None:
    user_id = uuid4()
    value = issue_device_cookie(user_id)
    claim = read_device_cookie(value)
    assert claim is not None
    assert claim.user_id == user_id

    head, _, signature = value.rpartition(".")
    flipped = "A" if signature[0] != "A" else "B"
    assert read_device_cookie(f"{head}.{flipped}{signature[1:]}") is None
    other_user = f"{uuid4()}.{value.split('.', 1)[1]}"
    assert read_device_cookie(other_user) is None
    for junk in (None, "", "nonsense", "a.b.c", "x" * 300):
        assert read_device_cookie(junk) is None


class RecordingEmailSender:
    def __init__(self) -> None:
        self.paused: list[tuple[str, int]] = []

    def send_verification_email(self, **_kwargs: object) -> None:
        return None

    def send_login_paused_notice(self, *, recipient: str, paused_minutes: int) -> None:
        self.paused.append((recipient, paused_minutes))


def test_login_route_answers_429_with_retry_after(api_client, member) -> None:
    for _ in range(5):
        response = api_client.post(
            "/api/v1/auth/login", json={"email": EMAIL, "password": WRONG}
        )
        assert response.status_code == 401

    response = api_client.post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}
    )

    assert response.status_code == 429
    assert response.headers["Retry-After"] == "60"
    assert response.json()["error"] == {
        "code": "login_throttled",
        "message": "Too many sign-in attempts. Try again in 1 minute.",
        "details": {"retry_after_seconds": 60},
    }


def test_login_route_keeps_a_recognised_browser_signed_in_during_an_attack(
    api_client, member
) -> None:
    sender = RecordingEmailSender()
    api_client.app.dependency_overrides[get_email_sender] = lambda: sender

    first = api_client.post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}
    )
    assert first.status_code == 204
    assert DEVICE_COOKIE_NAME in first.cookies

    for index in range(20):
        attacker = TestClient(api_client.app, client=(f"203.0.113.{index}", 4000))
        response = attacker.post(
            "/api/v1/auth/login", json={"email": EMAIL, "password": WRONG}
        )
        assert response.status_code == 401
    assert sender.paused == [(EMAIL, 1)]

    newcomer = TestClient(api_client.app, client=("192.0.2.200", 4000))
    blocked = newcomer.post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}
    )
    assert blocked.status_code == 429

    again = api_client.post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}
    )
    assert again.status_code == 204
    # Already recognised, so no new device cookie is issued.
    assert DEVICE_COOKIE_NAME not in again.cookies
