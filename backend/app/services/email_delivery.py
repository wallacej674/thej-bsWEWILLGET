import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from typing import Protocol

from app.core.settings import Settings, get_settings


class EmailDeliveryError(RuntimeError):
    """Outbound email could not be accepted by the configured provider."""


class EmailSender(Protocol):
    def send_verification_email(
        self, *, recipient: str, display_name: str, token: str
    ) -> None: ...

    def send_login_paused_notice(
        self, *, recipient: str, paused_minutes: int
    ) -> None: ...

    def send_password_reset_email(self, *, recipient: str, token: str) -> None: ...

    def send_password_changed_notice(self, *, recipient: str) -> None: ...


class SmtpEmailSender:
    def send_verification_email(
        self, *, recipient: str, display_name: str, token: str
    ) -> None:
        settings = self._configured_settings()
        verification_url = (
            f"{settings.frontend_base_url.rstrip('/')}/verify-email?token={token}"
        )
        safe_display_name = escape(display_name)
        safe_verification_url = escape(verification_url, quote=True)
        message = self._message(settings, recipient, "Verify your ApplyTogether email")
        message.set_content(
            f"Hi {display_name},\n\n"
            "Verify your email to finish creating your ApplyTogether account:\n"
            f"{verification_url}\n\n"
            f"This link expires in {settings.email_verification_hours} hours."
        )
        message.add_alternative(
            "<html><body>"
            f"<p>Hi {safe_display_name},</p>"
            "<p>Verify your email to finish creating your "
            "ApplyTogether account.</p>"
            f'<p><a href="{safe_verification_url}">Verify email</a></p>'
            f"<p>This link expires in "
            f"{settings.email_verification_hours} hours.</p>"
            "</body></html>",
            subtype="html",
        )
        self._deliver(settings, message, "The verification email could not be sent.")

    def send_login_paused_notice(self, *, recipient: str, paused_minutes: int) -> None:
        """Tell an account owner that sign-ins from new devices were paused.

        Deliberately carries no user-supplied text (see SEC-11).
        """
        settings = self._configured_settings()
        unit = "minute" if paused_minutes == 1 else "minutes"
        lines = [
            "Someone has been repeatedly trying to sign in to your ApplyTogether "
            "account with the wrong password.",
            "To protect it, we've paused sign-in attempts from devices you haven't "
            f"used before for {paused_minutes} {unit}. Browsers you've already "
            "signed in from still work.",
            "If this was you, wait a few minutes and try again. If it wasn't, "
            "nobody got in. Consider switching to a longer, unique password from "
            "your Profile.",
        ]
        message = self._message(
            settings, recipient, "Sign-in attempts paused on your ApplyTogether account"
        )
        message.set_content("\n\n".join(lines))
        message.add_alternative(
            "<html><body>"
            + "".join(f"<p>{escape(line)}</p>" for line in lines)
            + "</body></html>",
            subtype="html",
        )
        self._deliver(settings, message, "The security notice could not be sent.")

    def send_password_reset_email(self, *, recipient: str, token: str) -> None:
        settings = self._configured_settings()
        reset_url = (
            f"{settings.frontend_base_url.rstrip('/')}/reset-password?token={token}"
        )
        minutes = settings.password_reset_minutes
        message = self._message(
            settings, recipient, "Reset your ApplyTogether password"
        )
        message.set_content(
            "Someone asked to reset the password for your ApplyTogether account.\n\n"
            f"Choose a new password here (the link works once, for {minutes} "
            f"minutes):\n{reset_url}\n\n"
            "If you didn't ask for this, ignore this email; your password stays "
            "the same."
        )
        message.add_alternative(
            "<html><body>"
            "<p>Someone asked to reset the password for your ApplyTogether "
            "account.</p>"
            f'<p><a href="{escape(reset_url, quote=True)}">Choose a new password</a>'
            f" (works once, for {minutes} minutes).</p>"
            "<p>If you didn't ask for this, ignore this email; your password "
            "stays the same.</p>"
            "</body></html>",
            subtype="html",
        )
        self._deliver(settings, message, "The password reset email could not be sent.")

    def send_password_changed_notice(self, *, recipient: str) -> None:
        settings = self._configured_settings()
        lines = [
            "The password for your ApplyTogether account was just changed, and "
            "every device was signed out.",
            "If this was you, there's nothing else to do. If it wasn't, reset "
            "your password straight away from the sign-in page.",
        ]
        message = self._message(
            settings, recipient, "Your ApplyTogether password was changed"
        )
        message.set_content("\n\n".join(lines))
        message.add_alternative(
            "<html><body>"
            + "".join(f"<p>{escape(line)}</p>" for line in lines)
            + "</body></html>",
            subtype="html",
        )
        self._deliver(
            settings, message, "The password change notice could not be sent."
        )

    @staticmethod
    def _configured_settings() -> Settings:
        settings = get_settings()
        if (
            not settings.smtp_username
            or not settings.smtp_app_password
            or not settings.smtp_from_email
        ):
            raise EmailDeliveryError("Outbound email is not configured.")
        return settings

    @staticmethod
    def _message(settings: Settings, recipient: str, subject: str) -> EmailMessage:
        message = EmailMessage()
        message["Subject"] = subject
        # _configured_settings has already refused a missing sender address.
        message["From"] = formataddr(
            (settings.smtp_from_name, settings.smtp_from_email or "")
        )
        message["To"] = recipient
        return message

    @staticmethod
    def _deliver(settings: Settings, message: EmailMessage, failure: str) -> None:
        assert settings.smtp_username is not None
        assert settings.smtp_app_password is not None
        try:
            with smtplib.SMTP(
                settings.smtp_host,
                settings.smtp_port,
                timeout=settings.smtp_timeout_seconds,
            ) as smtp:
                smtp.ehlo()
                if settings.smtp_starttls:
                    smtp.starttls(context=ssl.create_default_context())
                    smtp.ehlo()
                smtp.login(
                    settings.smtp_username,
                    settings.smtp_app_password.replace(" ", ""),
                )
                smtp.send_message(message)
        except (OSError, smtplib.SMTPException) as error:
            raise EmailDeliveryError(failure) from error
