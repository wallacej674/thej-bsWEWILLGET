from datetime import timedelta
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.enums import (
    ApplicationStatus,
    EmploymentType,
    MembershipRole,
    WorkArrangement,
)
from app.core.errors import AppError
from app.core.time import application_today, utc_now
from app.core.url_normalization import normalize_job_posting_url
from app.models.application import JobApplication
from app.models.membership import WorkspaceMembership
from app.models.user import User
from app.repositories.application_repository import ApplicationRepository
from app.schemas.application import (
    ApplicationCreate,
    ApplicationListResponse,
    ApplicationOwner,
    ApplicationOwnerSummary,
    ApplicationResponse,
    ApplicationsOverTimePoint,
    ApplicationSummaryResponse,
    ApplicationUpdate,
    DeletedApplicationListResponse,
    DeletedApplicationResponse,
    Pagination,
    PermanentDeleteRequest,
    PermanentDeleteResponse,
    RecentApplicationActivity,
)


class ApplicationService:
    def __init__(self, repository: ApplicationRepository | None = None) -> None:
        self._repository = repository or ApplicationRepository()

    def create(
        self,
        session: Session,
        workspace_id: UUID,
        owner: User,
        payload: ApplicationCreate,
    ) -> ApplicationResponse:
        if (
            payload.application_date is not None
            and payload.application_date > application_today()
        ):
            raise AppError(
                400,
                "validation_error",
                "application_date cannot be in the future.",
            )
        normalized_url = normalize_job_posting_url(payload.job_posting_url)
        existing = self._repository.find_by_normalized_url(
            session, workspace_id, owner.id, normalized_url
        )
        if existing is not None:
            if existing.deleted_at is not None:
                raise AppError(
                    409,
                    "deleted_application_exists",
                    "You have a deleted application for this posting. Restore it instead.",
                )
            raise AppError(
                409,
                "duplicate_application",
                "You have already recorded an application for this posting.",
            )

        application = JobApplication(
            workspace_id=workspace_id,
            owner_id=owner.id,
            company_name=payload.company_name,
            job_title=payload.job_title,
            job_posting_url=payload.job_posting_url,
            normalized_job_posting_url=normalized_url,
            location=payload.location,
            work_arrangement=payload.work_arrangement,
            employment_type=payload.employment_type,
            application_date=payload.application_date or application_today(),
            status=payload.status,
            salary_min=payload.salary_min,
            salary_max=payload.salary_max,
            salary_currency=payload.salary_currency,
            salary_period=payload.salary_period,
            job_description=payload.job_description,
            notes=payload.notes,
        )
        self._repository.add(session, application)
        try:
            session.commit()
        except IntegrityError as error:
            session.rollback()
            raise AppError(
                409,
                "duplicate_application",
                "You have already recorded an application for this posting.",
            ) from error
        session.refresh(application)
        return ApplicationResponse.from_application(application, owner)

    def list_active(
        self,
        session: Session,
        workspace_id: UUID,
        *,
        search: str | None,
        owner_id: UUID | None,
        status: ApplicationStatus | None,
        work_arrangement: WorkArrangement | None,
        employment_type: EmploymentType | None,
        sort_by: str,
        sort_order: str,
        page: int,
        page_size: int,
    ) -> ApplicationListResponse:
        rows, total = self._repository.list_active(
            session,
            workspace_id,
            search=search,
            owner_id=owner_id,
            status=status,
            work_arrangement=work_arrangement,
            employment_type=employment_type,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            page_size=page_size,
        )
        return ApplicationListResponse(
            items=[
                ApplicationResponse.from_application(application, owner)
                for application, owner in rows
            ],
            pagination=Pagination(
                page=page,
                page_size=page_size,
                total_items=total,
                total_pages=(total + page_size - 1) // page_size if total else 0,
            ),
        )

    def summarize(
        self, session: Session, workspace_id: UUID
    ) -> ApplicationSummaryResponse:
        today = application_today()
        month_start = today.replace(day=1)
        next_month_start = (
            month_start.replace(year=month_start.year + 1, month=1)
            if month_start.month == 12
            else month_start.replace(month=month_start.month + 1)
        )
        rows, current_month = self._repository.summarize_active(
            session, workspace_id, month_start, next_month_start
        )
        by_owner = [
            ApplicationOwnerSummary(
                owner=ApplicationOwner.from_user(owner),
                count=count,
            )
            for owner, count in rows
        ]
        dashboard_rows = self._repository.list_active_for_dashboard(
            session, workspace_id
        )
        status_counts = {status: 0 for status in ApplicationStatus}
        work_arrangement_counts = {arrangement: 0 for arrangement in WorkArrangement}
        for application, _owner in dashboard_rows:
            status_counts[application.status] += 1
            work_arrangement_counts[application.work_arrangement] += 1

        current_week_start = today - timedelta(days=today.weekday())
        week_starts = [
            current_week_start - timedelta(weeks=offset)
            for offset in reversed(range(8))
        ]
        applications_over_time = []
        for week_start in week_starts:
            next_week_start = week_start + timedelta(days=7)
            owner_counts = {owner_summary.owner.id: 0 for owner_summary in by_owner}
            for application, _owner in dashboard_rows:
                if week_start <= application.application_date < next_week_start:
                    owner_counts[application.owner_id] = (
                        owner_counts.get(application.owner_id, 0) + 1
                    )
            applications_over_time.append(
                ApplicationsOverTimePoint(
                    week_start=week_start,
                    by_owner=[
                        ApplicationOwnerSummary(
                            owner=owner_summary.owner,
                            count=owner_counts.get(owner_summary.owner.id, 0),
                        )
                        for owner_summary in by_owner
                    ],
                )
            )

        recent_activity = [
            RecentApplicationActivity(
                application_id=application.id,
                company_name=application.company_name,
                job_title=application.job_title,
                owner=ApplicationOwner.from_user(owner),
                action=(
                    "added"
                    if abs(
                        (
                            application.updated_at - application.created_at
                        ).total_seconds()
                    )
                    < 1
                    else "updated"
                ),
                occurred_at=application.updated_at,
                status=application.status,
            )
            for application, owner in dashboard_rows[:5]
        ]
        recently_updated = sum(
            1
            for application, _owner in dashboard_rows
            if abs((application.updated_at - application.created_at).total_seconds())
            >= 1
        )
        return ApplicationSummaryResponse(
            total_active=sum(owner.count for owner in by_owner),
            current_month=current_month,
            recently_updated=recently_updated,
            by_owner=by_owner,
            status_counts=status_counts,
            work_arrangement_counts=work_arrangement_counts,
            applications_over_time=applications_over_time,
            recent_activity=recent_activity,
        )

    def get_active(
        self, session: Session, workspace_id: UUID, application_id: UUID
    ) -> ApplicationResponse:
        application = self._require_application(session, workspace_id, application_id)
        if application.deleted_at is not None:
            raise AppError(404, "application_not_found", "Application was not found.")
        owner = session.get(User, application.owner_id)
        if owner is None:
            raise AppError(404, "application_not_found", "Application was not found.")
        return ApplicationResponse.from_application(application, owner)

    def update(
        self,
        session: Session,
        workspace_id: UUID,
        application_id: UUID,
        current_user: User,
        payload: ApplicationUpdate,
    ) -> ApplicationResponse:
        application = self._require_owned_active_application(
            session, workspace_id, application_id, current_user
        )
        changes = payload.model_dump(exclude_unset=True)
        if "job_posting_url" in changes:
            normalized_url = normalize_job_posting_url(changes["job_posting_url"])
            if normalized_url != application.normalized_job_posting_url:
                existing = self._repository.find_by_normalized_url(
                    session, workspace_id, current_user.id, normalized_url
                )
                if existing is not None and existing.id != application.id:
                    code = (
                        "deleted_application_exists"
                        if existing.deleted_at is not None
                        else "duplicate_application"
                    )
                    raise AppError(409, code, "You have already recorded this posting.")
                application.normalized_job_posting_url = normalized_url
        merged = {
            "company_name": changes.get("company_name", application.company_name),
            "job_title": changes.get("job_title", application.job_title),
            "job_posting_url": changes.get(
                "job_posting_url", application.job_posting_url
            ),
            "location": changes.get("location", application.location),
            "work_arrangement": changes.get(
                "work_arrangement", application.work_arrangement
            ),
            "employment_type": changes.get(
                "employment_type", application.employment_type
            ),
            "application_date": changes.get(
                "application_date", application.application_date
            ),
            "status": changes.get("status", application.status),
            "salary_min": changes.get("salary_min", application.salary_min),
            "salary_max": changes.get("salary_max", application.salary_max),
            "salary_currency": changes.get(
                "salary_currency", application.salary_currency
            ),
            "salary_period": changes.get("salary_period", application.salary_period),
            "job_description": changes.get(
                "job_description", application.job_description
            ),
            "notes": changes.get("notes", application.notes),
        }
        try:
            validated = ApplicationCreate.model_validate(merged)
        except ValidationError as error:
            raise AppError(
                400,
                "validation_error",
                "Application update is invalid.",
                error.errors(),
            ) from error
        if (
            validated.application_date is not None
            and validated.application_date > application_today()
        ):
            raise AppError(
                400, "validation_error", "application_date cannot be in the future."
            )
        for field, value in changes.items():
            setattr(application, field, value)
        application.updated_at = utc_now()
        self._commit(session)
        return ApplicationResponse.from_application(application, current_user)

    def soft_delete(
        self,
        session: Session,
        workspace_id: UUID,
        application_id: UUID,
        current_user: User,
        membership: WorkspaceMembership,
    ) -> None:
        application = self._require_application(session, workspace_id, application_id)
        if (
            application.owner_id != current_user.id
            and membership.role
            not in {MembershipRole.OWNER, MembershipRole.ADMIN}
        ):
            raise AppError(
                403,
                "application_delete_forbidden",
                "Only the application author, a workspace admin, or the owner may delete it.",
            )
        if application.deleted_at is not None:
            raise AppError(
                409, "application_already_deleted", "Application is already deleted."
            )
        application.deleted_at = utc_now()
        application.deleted_by_user_id = current_user.id
        application.updated_at = utc_now()
        self._commit(session)

    def list_deleted(
        self,
        session: Session,
        workspace_id: UUID,
        current_user: User,
        page: int,
        page_size: int,
    ) -> DeletedApplicationListResponse:
        applications, total = self._repository.list_deleted(
            session,
            workspace_id,
            current_user.id,
            page,
            page_size,
        )
        return DeletedApplicationListResponse(
            items=[
                DeletedApplicationResponse.from_deleted_application(
                    application, owner, deleted_by
                )
                for application, owner, deleted_by in applications
            ],
            pagination=Pagination(
                page=page,
                page_size=page_size,
                total_items=total,
                total_pages=(total + page_size - 1) // page_size if total else 0,
            ),
        )

    def restore(
        self,
        session: Session,
        workspace_id: UUID,
        application_id: UUID,
        current_user: User,
    ) -> ApplicationResponse:
        application = self._require_application(session, workspace_id, application_id)
        if application.deleted_at is None:
            raise AppError(
                409, "application_not_deleted", "Application is not deleted."
            )
        if application.deleted_by_user_id != current_user.id:
            raise AppError(
                403,
                "application_restore_forbidden",
                "Only the person who deleted this application may restore it.",
            )
        application.deleted_at = None
        application.deleted_by_user_id = None
        application.updated_at = utc_now()
        self._commit(session)
        owner = session.get(User, application.owner_id)
        if owner is None:
            raise AppError(404, "application_not_found", "Application was not found.")
        return ApplicationResponse.from_application(application, owner)

    def permanently_delete(
        self,
        session: Session,
        workspace_id: UUID,
        current_user: User,
        payload: PermanentDeleteRequest,
    ) -> PermanentDeleteResponse:
        applications = self._repository.list_deleted_for_permanent_deletion(
            session,
            workspace_id,
            application_ids=None if payload.delete_all else payload.application_ids,
            eligible_user_id=current_user.id if payload.delete_all else None,
        )
        if not payload.delete_all and len(applications) != len(payload.application_ids):
            raise AppError(
                404,
                "deleted_application_not_found",
                "One or more selected applications were not found.",
            )
        unauthorized = any(
            application.deleted_by_user_id != current_user.id
            for application in applications
        )
        if unauthorized:
            raise AppError(
                403,
                "permanent_delete_forbidden",
                "You may permanently delete only applications you deleted.",
            )
        for application in applications:
            session.delete(application)
        session.commit()
        return PermanentDeleteResponse(deleted_count=len(applications))

    def _require_application(
        self, session: Session, workspace_id: UUID, application_id: UUID
    ) -> JobApplication:
        application = self._repository.get_in_workspace(
            session, workspace_id, application_id
        )
        if application is None:
            raise AppError(404, "application_not_found", "Application was not found.")
        return application

    def _require_owner(self, application: JobApplication, current_user: User) -> None:
        if application.owner_id != current_user.id:
            raise AppError(
                403,
                "application_ownership_required",
                "Only the application owner may perform this action.",
            )

    def _require_owned_active_application(
        self,
        session: Session,
        workspace_id: UUID,
        application_id: UUID,
        current_user: User,
    ) -> JobApplication:
        application = self._require_application(session, workspace_id, application_id)
        self._require_owner(application, current_user)
        if application.deleted_at is not None:
            raise AppError(
                409,
                "application_already_deleted",
                "Restore the application before updating it.",
            )
        return application

    def _commit(self, session: Session) -> None:
        try:
            session.commit()
        except IntegrityError as error:
            session.rollback()
            raise AppError(
                409, "duplicate_application", "You have already recorded this posting."
            ) from error
