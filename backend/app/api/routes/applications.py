from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from app.api.dependencies.current_user import CurrentUser, DatabaseSession
from app.api.dependencies.workspace_access import WorkspaceAccess
from app.core.enums import ApplicationStatus, EmploymentType, WorkArrangement
from app.schemas.application import (
    ApplicationCreate,
    ApplicationListResponse,
    ApplicationResponse,
    ApplicationSummaryResponse,
    ApplicationUpdate,
    DeletedApplicationListResponse,
    PermanentDeleteRequest,
    PermanentDeleteResponse,
)
from app.services.application_service import ApplicationService

router = APIRouter(
    prefix="/workspaces/{workspace_id}/applications", tags=["applications"]
)
application_service = ApplicationService()


@router.get("/summary", response_model=ApplicationSummaryResponse)
def summarize_applications(
    workspace_id: UUID,
    _membership: WorkspaceAccess,
    session: DatabaseSession,
) -> ApplicationSummaryResponse:
    return application_service.summarize(session, workspace_id)


@router.get("", response_model=ApplicationListResponse)
def list_applications(
    workspace_id: UUID,
    _membership: WorkspaceAccess,
    session: DatabaseSession,
    search: Annotated[str | None, Query(max_length=200)] = None,
    owner_id: UUID | None = None,
    status_filter: Annotated[ApplicationStatus | None, Query(alias="status")] = None,
    work_arrangement: WorkArrangement | None = None,
    employment_type: EmploymentType | None = None,
    sort_by: Literal[
        "application_date", "created_at", "updated_at", "company_name", "job_title"
    ] = "application_date",
    sort_order: Literal["asc", "desc"] = "desc",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ApplicationListResponse:
    return application_service.list_active(
        session,
        workspace_id,
        search=search.strip() or None if search else None,
        owner_id=owner_id,
        status=status_filter,
        work_arrangement=work_arrangement,
        employment_type=employment_type,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )


@router.get("/deleted", response_model=DeletedApplicationListResponse)
def list_deleted_applications(
    workspace_id: UUID,
    current_user: CurrentUser,
    _membership: WorkspaceAccess,
    session: DatabaseSession,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> DeletedApplicationListResponse:
    return application_service.list_deleted(
        session, workspace_id, current_user, page, page_size
    )


@router.post(
    "/deleted/permanent-delete",
    response_model=PermanentDeleteResponse,
)
def permanently_delete_applications(
    workspace_id: UUID,
    payload: PermanentDeleteRequest,
    current_user: CurrentUser,
    _membership: WorkspaceAccess,
    session: DatabaseSession,
) -> PermanentDeleteResponse:
    return application_service.permanently_delete(
        session, workspace_id, current_user, payload
    )


@router.get("/{application_id}", response_model=ApplicationResponse)
def get_application(
    workspace_id: UUID,
    application_id: UUID,
    _membership: WorkspaceAccess,
    session: DatabaseSession,
) -> ApplicationResponse:
    return application_service.get_active(session, workspace_id, application_id)


@router.patch("/{application_id}", response_model=ApplicationResponse)
def update_application(
    workspace_id: UUID,
    application_id: UUID,
    payload: ApplicationUpdate,
    current_user: CurrentUser,
    _membership: WorkspaceAccess,
    session: DatabaseSession,
) -> ApplicationResponse:
    return application_service.update(
        session, workspace_id, application_id, current_user, payload
    )


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(
    workspace_id: UUID,
    application_id: UUID,
    current_user: CurrentUser,
    membership: WorkspaceAccess,
    session: DatabaseSession,
) -> Response:
    application_service.soft_delete(
        session, workspace_id, application_id, current_user, membership
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{application_id}/restore", response_model=ApplicationResponse)
def restore_application(
    workspace_id: UUID,
    application_id: UUID,
    current_user: CurrentUser,
    _membership: WorkspaceAccess,
    session: DatabaseSession,
) -> ApplicationResponse:
    return application_service.restore(
        session, workspace_id, application_id, current_user
    )


@router.post(
    "", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED
)
def create_application(
    workspace_id: UUID,
    payload: ApplicationCreate,
    current_user: CurrentUser,
    session: DatabaseSession,
    _membership: WorkspaceAccess,
) -> ApplicationResponse:
    return application_service.create(session, workspace_id, current_user, payload)
