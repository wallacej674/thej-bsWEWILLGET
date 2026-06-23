from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.time import utc_now
from app.models.resume import UserResume
from app.models.user import User
from app.repositories.resume_repository import ResumeRepository
from app.schemas.resume import ParserStatus, ResumeProfileResponse, ResumeUploadResult

MAX_RESUME_BYTES = 3 * 1024 * 1024
MIN_USEFUL_TEXT_LENGTH = 120
REQUIRED_SECTIONS = {
    "Experience": ("experience", "employment", "work history"),
    "Education": ("education",),
    "Skills": ("skills", "technical skills"),
    "Projects": ("projects", "portfolio"),
}


class ResumeService:
    def __init__(self, repository: ResumeRepository | None = None) -> None:
        self._repository = repository or ResumeRepository()

    def get_resume(
        self, session: Session, current_user: User
    ) -> ResumeProfileResponse | None:
        resume = self._repository.get_for_user(session, current_user.id)
        return ResumeProfileResponse.from_resume(resume) if resume else None

    def upload_resume(
        self,
        session: Session,
        current_user: User,
        *,
        filename: str,
        content_type: str | None,
        data: bytes,
    ) -> ResumeProfileResponse:
        self._validate_upload(filename, content_type, data)
        parsed = self.extract_pdf_text(data)
        if parsed.parser_status == "unreadable":
            raise AppError(
                422,
                "resume_unreadable",
                "The PDF did not contain readable resume text.",
                parsed.parser_warnings,
            )

        resume = self._repository.get_for_user(session, current_user.id)
        if resume is None:
            resume = UserResume(
                user_id=current_user.id,
                original_filename=filename[:255],
                extracted_text=parsed.text,
                parser_status=parsed.parser_status,
                parser_warnings=parsed.parser_warnings,
            )
            session.add(resume)
        else:
            resume.original_filename = filename[:255]
            resume.extracted_text = parsed.text
            resume.parser_status = parsed.parser_status
            resume.parser_warnings = parsed.parser_warnings
            resume.updated_at = utc_now()
        session.commit()
        session.refresh(resume)
        return ResumeProfileResponse.from_resume(resume)

    def delete_resume(self, session: Session, current_user: User) -> None:
        resume = self._repository.get_for_user(session, current_user.id)
        if resume is not None:
            session.delete(resume)
            session.commit()

    def extract_pdf_text(self, data: bytes) -> ResumeUploadResult:
        try:
            reader = PdfReader(BytesIO(data))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except (PdfReadError, ValueError, TypeError, OSError) as error:
            raise AppError(
                422,
                "resume_parse_failed",
                "The PDF could not be parsed.",
            ) from error

        normalized = "\n".join(
            line.strip() for line in text.splitlines() if line.strip()
        )
        warnings = self._ats_warnings(normalized)
        if not normalized:
            return ResumeUploadResult(
                text="",
                parser_status="unreadable",
                parser_warnings=[
                    "No readable text was found. This may be a scanned PDF."
                ],
            )
        status: ParserStatus = "warning" if warnings else "ready"
        return ResumeUploadResult(
            text=normalized,
            parser_status=status,
            parser_warnings=warnings,
        )

    def _validate_upload(
        self, filename: str, content_type: str | None, data: bytes
    ) -> None:
        if not filename.lower().endswith(".pdf") or content_type not in {
            "application/pdf",
            "application/x-pdf",
        }:
            raise AppError(415, "resume_file_type_invalid", "Upload a PDF resume.")
        if len(data) > MAX_RESUME_BYTES:
            raise AppError(
                413,
                "resume_file_too_large",
                "Upload a resume PDF smaller than 3 MB.",
            )
        if not data:
            raise AppError(422, "resume_empty", "The uploaded resume was empty.")

    def _ats_warnings(self, text: str) -> list[str]:
        lower = text.lower()
        warnings: list[str] = []
        if len(text) < MIN_USEFUL_TEXT_LENGTH:
            warnings.append("Extracted text is unusually short for a resume.")
        missing = [
            section
            for section, candidates in REQUIRED_SECTIONS.items()
            if not any(candidate in lower for candidate in candidates)
        ]
        if missing:
            warnings.append(f"Missing common resume sections: {', '.join(missing)}.")
        return warnings
