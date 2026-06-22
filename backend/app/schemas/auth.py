from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, Field, field_validator

from app.core.settings import get_settings


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=1, max_length=1024)


class SignupRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)
    workspace_name: str = Field(min_length=1, max_length=200)

    @field_validator("display_name", "workspace_name")
    @classmethod
    def trim_nonempty(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("This field is required.")
        return trimmed

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        try:
            result = validate_email(
                value.strip(),
                check_deliverability=False,
                test_environment=get_settings().environment == "test",
            )
        except EmailNotValidError as error:
            raise ValueError("Enter a valid email address.") from error
        return result.normalized.lower()


class SignupResponse(BaseModel):
    message: str = "Check your email to continue."


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)


class VerifyEmailResponse(BaseModel):
    status: str = "verified"


class ResendVerificationRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return SignupRequest.normalize_email(value)


class ResendVerificationResponse(BaseModel):
    message: str = "If an account is pending, a new link was sent."
