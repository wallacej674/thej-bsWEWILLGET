from typing import Annotated

from fastapi import APIRouter, File, Response, UploadFile, status

from app.api.dependencies.current_user import CurrentUser, DatabaseSession
from app.schemas.resume import ResumeProfileResponse
from app.services.resume_service import ResumeService

router = APIRouter(prefix="/profile", tags=["profile"])
resume_service = ResumeService()


@router.get("/resume", response_model=ResumeProfileResponse | None)
def get_resume(
    current_user: CurrentUser, session: DatabaseSession
) -> ResumeProfileResponse | None:
    return resume_service.get_resume(session, current_user)


@router.post("/resume", response_model=ResumeProfileResponse)
async def upload_resume(
    current_user: CurrentUser,
    session: DatabaseSession,
    file: Annotated[UploadFile, File()],
) -> ResumeProfileResponse:
    data = await file.read()
    return resume_service.upload_resume(
        session,
        current_user,
        filename=file.filename or "resume.pdf",
        content_type=file.content_type,
        data=data,
    )


@router.delete("/resume", status_code=status.HTTP_204_NO_CONTENT)
def delete_resume(current_user: CurrentUser, session: DatabaseSession) -> Response:
    resume_service.delete_resume(session, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
