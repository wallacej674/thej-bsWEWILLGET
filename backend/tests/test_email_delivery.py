from types import SimpleNamespace

from app.services import email_delivery


class RecordingSmtp:
    instances: list["RecordingSmtp"] = []

    def __init__(self, host: str, port: int, timeout: int) -> None:
        self.host = host
        self.port = port
        self.timeout = timeout
        self.calls: list[object] = []
        self.message = None
        self.instances.append(self)

    def __enter__(self) -> "RecordingSmtp":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def ehlo(self) -> None:
        self.calls.append("ehlo")

    def starttls(self, *, context: object) -> None:
        self.calls.append(("starttls", context))

    def login(self, username: str, password: str) -> None:
        self.calls.append(("login", username, password))

    def send_message(self, message: object) -> None:
        self.message = message
        self.calls.append("send_message")


def test_google_smtp_sender_uses_starttls_and_app_password(monkeypatch) -> None:
    RecordingSmtp.instances.clear()
    settings = SimpleNamespace(
        smtp_host="smtp.gmail.com",
        smtp_port=587,
        smtp_username="sender@gmail.com",
        smtp_app_password="abcd efgh ijkl mnop",
        smtp_from_email="sender@gmail.com",
        smtp_from_name="ApplyTogether",
        smtp_starttls=True,
        smtp_timeout_seconds=15,
        frontend_base_url="https://apply.example",
        email_verification_hours=24,
    )
    monkeypatch.setattr(email_delivery, "get_settings", lambda: settings)
    monkeypatch.setattr(email_delivery.smtplib, "SMTP", RecordingSmtp)
    monkeypatch.setattr(
        email_delivery.ssl,
        "create_default_context",
        lambda: "secure-context",
    )

    email_delivery.SmtpEmailSender().send_verification_email(
        recipient="member@example.com",
        display_name="Amara Ellis",
        token="verification-token",
    )

    smtp = RecordingSmtp.instances[0]
    assert (smtp.host, smtp.port, smtp.timeout) == ("smtp.gmail.com", 587, 15)
    assert smtp.calls == [
        "ehlo",
        ("starttls", "secure-context"),
        "ehlo",
        ("login", "sender@gmail.com", "abcdefghijklmnop"),
        "send_message",
    ]
    assert smtp.message["From"] == "ApplyTogether <sender@gmail.com>"
    assert smtp.message["To"] == "member@example.com"
    assert "https://apply.example/verify-email?token=verification-token" in str(
        smtp.message
    )
