from authx.exceptions import AuthXException, MissingTokenError
from authx.schema import TokenPayload
from fastapi import APIRouter, Request, Response, status

from app.api.dependencies.current_user import CurrentUser, DatabaseSession
from app.api.dependencies.email_delivery import EmailSenderDependency
from app.core.auth import get_authx
from app.core.errors import AppError
from app.core.passwords import PasswordPolicyError
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
from app.services.email_delivery import EmailDeliveryError
from app.services.registration_service import (
    InvalidVerificationTokenError,
    RegistrationService,
)

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
def login(payload: LoginRequest, session: DatabaseSession) -> Response:
    try:
        result = authentication_service.login(
            session, email=payload.email, password=payload.password
        )
        session.commit()
    except InvalidCredentialsError as error:
        session.rollback()
        raise AppError(
            401,
            "invalid_credentials",
            "Email or password is incorrect.",
        ) from error

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _set_auth_cookies(response, result.access_token, result.refresh_token)
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
