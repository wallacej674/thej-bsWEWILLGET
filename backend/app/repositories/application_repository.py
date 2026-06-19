from uuid import UUID

from sqlalchemy import Select, asc, desc, func, or_, select
from sqlalchemy.orm import Session

from app.core.enums import ApplicationStatus, EmploymentType, WorkArrangement
from app.models.application import JobApplication
from app.models.user import User


class ApplicationRepository:
    def find_by_normalized_url(
        self,
        session: Session,
        workspace_id: UUID,
        owner_id: UUID,
        normalized_url: str,
    ) -> JobApplication | None:
        statement = select(JobApplication).where(
            JobApplication.workspace_id == workspace_id,
            JobApplication.owner_id == owner_id,
            JobApplication.normalized_job_posting_url == normalized_url,
        )
        return session.scalar(statement)

    def add(self, session: Session, application: JobApplication) -> None:
        session.add(application)

    def get_in_workspace(
        self, session: Session, workspace_id: UUID, application_id: UUID
    ) -> JobApplication | None:
        return session.scalar(
            select(JobApplication).where(
                JobApplication.workspace_id == workspace_id,
                JobApplication.id == application_id,
            )
        )

    def list_deleted_for_owner(
        self,
        session: Session,
        workspace_id: UUID,
        owner_id: UUID,
        page: int,
        page_size: int,
    ) -> tuple[list[JobApplication], int]:
        filters = [
            JobApplication.workspace_id == workspace_id,
            JobApplication.owner_id == owner_id,
            JobApplication.deleted_at.is_not(None),
        ]
        statement = (
            select(JobApplication)
            .where(*filters)
            .order_by(desc(JobApplication.deleted_at), JobApplication.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        total = session.scalar(
            select(func.count()).select_from(JobApplication).where(*filters)
        )
        return list(session.scalars(statement)), total or 0

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
    ) -> tuple[list[tuple[JobApplication, User]], int]:
        filters = [
            JobApplication.workspace_id == workspace_id,
            JobApplication.deleted_at.is_(None),
        ]
        if search:
            pattern = f"%{search}%"
            filters.append(
                or_(
                    JobApplication.company_name.ilike(pattern),
                    JobApplication.job_title.ilike(pattern),
                )
            )
        if owner_id is not None:
            filters.append(JobApplication.owner_id == owner_id)
        if status is not None:
            filters.append(JobApplication.status == status)
        if work_arrangement is not None:
            filters.append(JobApplication.work_arrangement == work_arrangement)
        if employment_type is not None:
            filters.append(JobApplication.employment_type == employment_type)

        sort_column = {
            "application_date": JobApplication.application_date,
            "created_at": JobApplication.created_at,
            "updated_at": JobApplication.updated_at,
            "company_name": JobApplication.company_name,
            "job_title": JobApplication.job_title,
        }[sort_by]
        ordering = asc(sort_column) if sort_order == "asc" else desc(sort_column)
        statement: Select[tuple[JobApplication, User]] = (
            select(JobApplication, User)
            .join(User, User.id == JobApplication.owner_id)
            .where(*filters)
            .order_by(ordering, JobApplication.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        total = session.scalar(
            select(func.count()).select_from(JobApplication).where(*filters)
        )
        return list(session.execute(statement).tuples()), total or 0
