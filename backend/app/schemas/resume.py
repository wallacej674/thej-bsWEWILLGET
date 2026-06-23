from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.resume import UserResume

ParserStatus = Literal["ready", "warning", "unreadable"]


class ResumeProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    original_filename: str
    parser_status: ParserStatus
    parser_warnings: list[str]
    extracted_text_preview: str
    extracted_text_length: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_resume(cls, resume: UserResume) -> "ResumeProfileResponse":
        return cls(
            id=resume.id,
            original_filename=resume.original_filename,
            parser_status=resume.parser_status,  # type: ignore[arg-type]
            parser_warnings=resume.parser_warnings,
            extracted_text_preview=resume.extracted_text[:600],
            extracted_text_length=len(resume.extracted_text),
            created_at=resume.created_at,
            updated_at=resume.updated_at,
        )


class ResumeUploadResult(BaseModel):
    text: str
    parser_status: ParserStatus
    parser_warnings: list[str]
