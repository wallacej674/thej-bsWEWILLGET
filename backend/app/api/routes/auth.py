import logging
from uuid import UUID

from authx.exceptions import AuthXException, MissingTokenError
from authx.schema import TokenPayload
from fastapi import APIRouter, Request, Response, status

from app.api.dependencies.current_user import CurrentUser, DatabaseSession
from app.api.dependencies.email_delivery import EmailSenderDependency
from app.core.auth import get_authx
from app.core.device_cookie import (
    DEVICE_COOKIE_NAME,
    DEVICE_COOKIE_PATH,
    issue_device_cookie,
    read_device_cookie,
)
from app.core.errors import AppError
from app.core.passwords import PasswordPolicyError
from app.core.settings import get_settings
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    ResendVerificationRequest,
    ResendVerificationResponse,
    SignupRequest,
    SignupResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
)
from app.services.auth_service import (
    AuthenticationService,
    CurrentPasswordInvalidError,
    InvalidCredentialsError,
    InvalidSessionError,
    RefreshTokenReuseError,
)
from app.services.email_delivery import EmailDeliveryError, EmailSender
from app.services.login_throttle import LoginThrottledError
from app.services.registration_service import (
    InvalidVerificationTokenError,
    RegistrationService,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
authentication_service = AuthenticationService()
registration_service = RegistrationService()


def _set_auth_cookies(
    response: Response, access_token: str, refresh_token: str
) -> None:
    authx = get_authx()
    authx.set_access_cookies(access_token, response)
    authx.set_refresh_cookies(refresh_token, response)


def _clear_auth_cookies(response: Response) -> None:
    get_authx().unset_cookies(response)


def _set_device_cookie(response: Response, user_id: UUID) -> None:
    settings = get_settings()
    response.set_cookie(
        DEVICE_COOKIE_NAME,
        issue_device_cookie(user_id),
        max_age=settings.login_device_cookie_days * 24 * 60 * 60,
        path=DEVICE_COOKIE_PATH,
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite=settings.auth_cookie_samesite,
    )


def _client_ip(request: Request) -> str:
    # Behind a proxy, run uvicorn with --proxy-headers and a trusted
    # --forwarded-allow-ips so this is the visitor's address, not the proxy's.
    return request.client.host if request.client else "unknown"


def _notify_login_paused(
    email_sender: EmailSender, recipient: str, paused_for_seconds: int
) -> None:
    try:
        email_sender.send_login_paused_notice(
            recipient=recipient,
            paused_minutes=max(1, -(-paused_for_seconds // 60)),
        )
    except EmailDeliveryError:
        # The pause still protects the account; the email is a courtesy.
        logger.warning("Could not send the sign-in paused notice.")


async def _refresh_token_payload(request: Request) -> TokenPayload:
    authx = get_authx()
    try:
        token = await authx.get_refresh_token_from_request(request)
        # AuthX validates the JWT signature, type, expiry, and the refresh
        # cookie's distinct CSRF header before rotation is attempted.
        return authx.verify_token(token, verify_csrf=True)
    except AuthXException as error:
        raise AppError(
            401,
            "invalid_refresh_token",
            "The refresh session is invalid.",
        ) from error


@router.post("/login", status_code=status.HTTP_204_NO_CONTENT)
def login(
    payload: LoginRequest,
    request: Request,
    session: DatabaseSession,
    email_sender: EmailSenderDependency,
) -> Response:
    try:
        result = authentication_service.login(
            session,
            email=payload.email,
            password=payload.password,
            client_ip=_client_ip(request),
            device=read_device_cookie(request.cookies.get(DEVICE_COOKIE_NAME)),
        )
        session.commit()
    except LoginThrottledError as error:
        session.rollback()
        minutes = error.retry_after_minutes
        raise AppError(
            429,
            "login_throttled",
            f"Too many sign-in attempts. Try again in {minutes} "
            f"minute{'' if minutes == 1 else 's'}.",
            {"retry_after_seconds": error.retry_after_seconds},
            headers={"Retry-After": str(error.retry_after_seconds)},
        ) from error
    except InvalidCredentialsError as error:
        # Commit, not roll back: the failure has to be counted.
        session.commit()
        if error.notify_user is not None:
            _notify_login_paused(
                email_sender, error.notify_user.email, error.paused_for_seconds
            )
        raise AppError(
            401,
            "invalid_credentials",
            "Email or password is incorrect.",
        ) from error

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _set_auth_cookies(response, result.access_token, result.refresh_token)
    if not result.trusted_device:
        _set_device_cookie(response, result.user.id)
    return response


@router.post(
    "/signup",
    response_model=SignupResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def signup(
    payload: SignupRequest,
    session: DatabaseSession,
    email_sender: EmailSenderDependency,
) -> SignupResponse:
    try:
        registration_service.signup(session, payload, email_sender)
    except EmailDeliveryError as error:
        raise AppError(
            503,
            "email_delivery_unavailable",
            "Your registration was saved, but the verification email could not be sent.",
        ) from error
    return SignupResponse()


@router.post("/verify-email", response_model=VerifyEmailResponse)
def verify_email(
    payload: VerifyEmailRequest,
    session: DatabaseSession,
) -> VerifyEmailResponse:
    try:
        registration_service.verify(session, payload.token)
    except InvalidVerificationTokenError as error:
        session.rollback()
        raise AppError(
            400,
            "verification_link_invalid",
            "This verification link is invalid or has expired.",
        ) from error
    return VerifyEmailResponse()


@router.post(
    "/resend-verification",
    response_model=ResendVerificationResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def resend_verification(
    payload: ResendVerificationRequest,
    session: DatabaseSession,
    email_sender: EmailSenderDependency,
) -> ResendVerificationResponse:
    try:
        registration_service.resend(session, payload.email, email_sender)
    except EmailDeliveryError as error:
        raise AppError(
            503,
            "email_delivery_unavailable",
            "The verification email could not be sent. Try again.",
        ) from error
    return ResendVerificationResponse()


@router.post("/refresh", status_code=status.HTTP_204_NO_CONTENT)
async def refresh(request: Request, session: DatabaseSession) -> Response:
    payload = await _refresh_token_payload(request)
    try:
        result = authentication_service.refresh(session, payload)
        session.commit()
    except RefreshTokenReuseError as error:
        session.commit()
        raise AppError(
            401,
            "session_revoked",
            "The refresh session is invalid.",
        ) from error
    except InvalidSessionError as error:
        session.rollback()
        raise AppError(
            401,
            "invalid_refresh_token",
            "The refresh session is invalid.",
        ) from error

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _set_auth_cookies(response, result.access_token, result.refresh_token)
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, session: DatabaseSession) -> Response:
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    authx = get_authx()
    try:
        token = await authx.get_access_token_from_request(request)
        payload = authx.verify_token(token, verify_csrf=True)
        authentication_service.revoke_session(session, payload)
        session.commit()
    except MissingTokenError:
        # Logging out twice must remain safe and clear any stale cookies.
        session.rollback()
    except AuthXException as error:
        session.rollback()
        raise AppError(
            403,
            "csrf_validation_failed",
            "The request could not be validated.",
        ) from error
    _clear_auth_cookies(response)
    return response


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    current_user: CurrentUser,
    session: DatabaseSession,
) -> Response:
    try:
        authentication_service.change_password(
            session,
            user=current_user,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
        session.commit()
    except CurrentPasswordInvalidError as error:
        session.rollback()
        raise AppError(
            400,
            "current_password_invalid",
            "The current password is incorrect.",
        ) from error
    except PasswordPolicyError as error:
        session.rollback()
        raise AppError(
            422,
            "password_policy_failed",
            str(error),
        ) from error

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_auth_cookies(response)
    return response
