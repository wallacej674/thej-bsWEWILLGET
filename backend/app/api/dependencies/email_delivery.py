from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.services.email_delivery import EmailSender, SmtpEmailSender


@lru_cache
def get_email_sender() -> EmailSender:
    return SmtpEmailSender()


EmailSenderDependency = Annotated[EmailSender, Depends(get_email_sender)]
