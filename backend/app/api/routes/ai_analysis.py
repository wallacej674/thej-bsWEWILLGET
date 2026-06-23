from uuid import UUID

from fastapi import APIRouter

from app.api.dependencies.ai_provider import AiProviderDependency
from app.api.dependencies.current_user import CurrentUser, DatabaseSession
from app.api.dependencies.workspace_access import WorkspaceAccess
from app.schemas.ai_analysis import ResumeTailorAnalysisResponse
from app.services.ai_analysis_service import AiAnalysisService

router = APIRouter(
    prefix="/workspaces/{workspace_id}/applications/{application_id}/ai",
    tags=["ai"],
)
analysis_service = AiAnalysisService()


@router.get("/resume-tailor", response_model=ResumeTailorAnalysisResponse)
def get_resume_tailor_analysis(
    workspace_id: UUID,
    application_id: UUID,
    current_user: CurrentUser,
    _membership: WorkspaceAccess,
    session: DatabaseSession,
) -> ResumeTailorAnalysisResponse:
    return analysis_service.get_resume_tailor_analysis(
        session, workspace_id, application_id, current_user
    )


@router.post("/resume-tailor", response_model=ResumeTailorAnalysisResponse)
def generate_resume_tailor_analysis(
    workspace_id: UUID,
    application_id: UUID,
    current_user: CurrentUser,
    _membership: WorkspaceAccess,
    session: DatabaseSession,
    provider: AiProviderDependency,
) -> ResumeTailorAnalysisResponse:
    return analysis_service.generate_resume_tailor_analysis(
        session, workspace_id, application_id, current_user, provider
    )
