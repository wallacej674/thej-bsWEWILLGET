from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ai_analysis import ApplicationAiAnalysis


class AiAnalysisRepository:
    def get_resume_tailor_analysis(
        self, session: Session, application_id: UUID, user_id: UUID, prompt_version: str
    ) -> ApplicationAiAnalysis | None:
        return session.scalar(
            select(ApplicationAiAnalysis).where(
                ApplicationAiAnalysis.application_id == application_id,
                ApplicationAiAnalysis.user_id == user_id,
                ApplicationAiAnalysis.prompt_version == prompt_version,
            )
        )
