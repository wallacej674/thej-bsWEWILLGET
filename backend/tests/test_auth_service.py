from authx.schema import TokenPayload

from app.core.auth import get_authx
from app.core.passwords import hash_password
from app.services.auth_service import AuthenticationService


def test_successful_login_creates_a_server_side_session(
    database_session, active_member
) -> None:
    active_member.password_hash = hash_password("correct horse battery staple")
    database_session.flush()

    result = AuthenticationService().login(
        database_session,
        email="JONATHAN@EXAMPLE.TEST",
        password="correct horse battery staple",
    )

    refresh_payload = TokenPayload.decode(
        result.refresh_token,
        key=get_authx().config.public_key,
        algorithms=[get_authx().config.JWT_ALGORITHM],
    )

    assert result.user.id == active_member.id
    assert result.session.user_id == active_member.id
    assert result.session.revoked_at is None
    assert refresh_payload.sid == str(result.session.id)
