from dataclasses import dataclass
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.time import utc_now
from app.models.ai_analysis import ApplicationAiAnalysis
from app.models.application import JobApplication
from app.models.user import User
from app.repositories.ai_analysis_repository import AiAnalysisRepository
from app.repositories.application_repository import ApplicationRepository
from app.repositories.resume_repository import ResumeRepository
from app.schemas.ai_analysis import (
    ResumeTailorAnalysisResponse,
    ResumeTailorResult,
)
from app.services.ai_provider import AiProvider

PROMPT_VERSION = "resume-tailor-v1"


@dataclass
class ResumeTailorPrompt:
    company_name: str
    job_title: str
    job_description: str
    resume_text: str
    ats_warnings: list[str]


class AiAnalysisService:
    def __init__(
        self,
        *,
        application_repository: ApplicationRepository | None = None,
        resume_repository: ResumeRepository | None = None,
        analysis_repository: AiAnalysisRepository | None = None,
    ) -> None:
        self._applications = application_repository or ApplicationRepository()
        self._resumes = resume_repository or ResumeRepository()
        self._analyses = analysis_repository or AiAnalysisRepository()

    def get_resume_tailor_analysis(
        self,
        session: Session,
        workspace_id: UUID,
        application_id: UUID,
        current_user: User,
    ) -> ResumeTailorAnalysisResponse:
        application = self._require_active_application(
            session, workspace_id, application_id
        )
        analysis = self._analyses.get_resume_tailor_analysis(
            session, application.id, current_user.id, PROMPT_VERSION
        )
        if analysis is None:
            raise AppError(
                404,
                "ai_analysis_not_found",
                "No AI resume analysis has been generated for this application.",
            )
        return ResumeTailorAnalysisResponse.from_analysis(analysis)

    def generate_resume_tailor_analysis(
        self,
        session: Session,
        workspace_id: UUID,
        application_id: UUID,
        current_user: User,
        provider: AiProvider,
    ) -> ResumeTailorAnalysisResponse:
        application = self._require_active_application(
            session, workspace_id, application_id
        )
        if not application.job_description or not application.job_description.strip():
            raise AppError(
                400,
                "job_description_required",
                "Add a job description before tailoring a resume.",
            )
        resume = self._resumes.get_for_user(session, current_user.id)
        if resume is None:
            raise AppError(
                400,
                "resume_required",
                "Upload a resume before tailoring it to this job.",
            )
        if resume.parser_status == "unreadable" or not resume.extracted_text.strip():
            raise AppError(
                400,
                "resume_unreadable",
                "Upload a readable resume before tailoring it to this job.",
            )

        prompt = ResumeTailorPrompt(
            company_name=application.company_name,
            job_title=application.job_title,
            job_description=application.job_description,
            resume_text=resume.extracted_text,
            ats_warnings=resume.parser_warnings,
        )
        raw_result = provider.tailor_resume(prompt)
        try:
            result = ResumeTailorResult.model_validate(raw_result)
        except ValidationError as error:
            raise AppError(
                502,
                "ai_provider_invalid_response",
                "The AI provider returned an invalid response.",
            ) from error

        analysis = self._analyses.get_resume_tailor_analysis(
            session, application.id, current_user.id, PROMPT_VERSION
        )
        result_data = result.model_dump(mode="json")
        if analysis is None:
            analysis = ApplicationAiAnalysis(
                workspace_id=workspace_id,
                application_id=application.id,
                user_id=current_user.id,
                prompt_version=PROMPT_VERSION,
                provider_name=provider.name,
                model_name=provider.model,
                result=result_data,
            )
            session.add(analysis)
        else:
            analysis.provider_name = provider.name
            analysis.model_name = provider.model
            analysis.result = result_data
            analysis.updated_at = utc_now()
        try:
            session.commit()
        except IntegrityError as error:
            session.rollback()
            raise AppError(
                409,
                "ai_analysis_conflict",
                "The analysis could not be saved. Please try again.",
            ) from error
        session.refresh(analysis)
        return ResumeTailorAnalysisResponse.from_analysis(analysis)

    def _require_active_application(
        self,
        session: Session,
        workspace_id: UUID,
        application_id: UUID,
    ) -> JobApplication:
        # Any active member of the workspace may run resume tailoring against a
        # visible application. The analysis is keyed per (application, user), so
        # it is the requesting member's own artifact and never mutates the
        # application or another member's analysis.
        application = self._applications.get_in_workspace(
            session, workspace_id, application_id
        )
        if application is None or application.deleted_at is not None:
            raise AppError(404, "application_not_found", "Application was not found.")
        return application
