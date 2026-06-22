import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from typing import Protocol

from app.core.settings import get_settings


class EmailDeliveryError(RuntimeError):
    """Outbound email could not be accepted by the configured provider."""


class EmailSender(Protocol):
    def send_verification_email(
        self, *, recipient: str, display_name: str, token: str
    ) -> None: ...


class SmtpEmailSender:
    def send_verification_email(
        self, *, recipient: str, display_name: str, token: str
    ) -> None:
        settings = get_settings()
        if (
            not settings.smtp_username
            or not settings.smtp_app_password
            or not settings.smtp_from_email
        ):
            raise EmailDeliveryError("Outbound email is not configured.")

        verification_url = (
            f"{settings.frontend_base_url.rstrip('/')}/verify-email?token={token}"
        )
        safe_display_name = escape(display_name)
        safe_verification_url = escape(verification_url, quote=True)
        message = EmailMessage()
        message["Subject"] = "Verify your ApplyTogether email"
        message["From"] = formataddr(
            (settings.smtp_from_name, settings.smtp_from_email)
        )
        message["To"] = recipient
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
            raise EmailDeliveryError(
                "The verification email could not be sent."
            ) from error
