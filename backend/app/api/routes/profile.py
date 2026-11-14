from typing import Annotated

from fastapi import APIRouter, File, Response, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.api.dependencies.current_user import CurrentUser, DatabaseSession
from app.core.errors import AppError
from app.core.settings import get_settings
from app.schemas.resume import ResumeProfileResponse
from app.services.rate_limit import enforce
from app.services.resume_service import MAX_RESUME_BYTES, ResumeService

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
    await run_in_threadpool(
        enforce,
        session,
        "resume-upload-user",
        str(current_user.id),
        get_settings().rate_limit_resume_upload_per_user,
    )
    data = await _read_capped(file, MAX_RESUME_BYTES)
    return await run_in_threadpool(
        resume_service.upload_resume,
        session,
        current_user,
        filename=file.filename or "resume.pdf",
        content_type=file.content_type,
        data=data,
    )


async def _read_capped(file: UploadFile, limit: int) -> bytes:
    """Read an upload in chunks, refusing as soon as it passes `limit`."""
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(64 * 1024):
        total += len(chunk)
        if total > limit:
            raise AppError(
                413,
                "resume_file_too_large",
                "Upload a resume PDF smaller than 3 MB.",
            )
        chunks.append(chunk)
    return b"".join(chunks)


@router.delete("/resume", status_code=status.HTTP_204_NO_CONTENT)
def delete_resume(current_user: CurrentUser, session: DatabaseSession) -> Response:
    resume_service.delete_resume(session, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
