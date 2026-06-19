from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import (
    ApplicationStatus,
    EmploymentType,
    SalaryPeriod,
    WorkArrangement,
)
from app.db.base import Base


class JobApplication(Base):
    __tablename__ = "job_applications"
    __table_args__ = (
        CheckConstraint(
            "status IN ('applied', 'rejected', 'withdrawn', 'closed')",
            name="ck_application_status",
        ),
        CheckConstraint(
            "work_arrangement IN ('remote', 'hybrid', 'onsite', 'unknown')",
            name="ck_application_work_arrangement",
        ),
        CheckConstraint(
            "employment_type IN ('full_time', 'part_time', 'contract', "
            "'internship', 'temporary', 'unknown')",
            name="ck_application_employment_type",
        ),
        CheckConstraint(
            "salary_period IS NULL OR salary_period IN ('hourly', 'monthly', 'yearly')",
            name="ck_application_salary_period",
        ),
        CheckConstraint(
            "salary_min IS NULL OR salary_min >= 0", name="ck_application_salary_min"
        ),
        CheckConstraint(
            "salary_max IS NULL OR salary_max >= 0", name="ck_application_salary_max"
        ),
        CheckConstraint(
            "salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max",
            name="ck_application_salary_range",
        ),
        CheckConstraint(
            "(salary_min IS NULL AND salary_max IS NULL) OR salary_period IS NOT NULL",
            name="ck_application_salary_period_required",
        ),
        UniqueConstraint(
            "workspace_id",
            "owner_id",
            "normalized_job_posting_url",
            name="uq_application_workspace_owner_normalized_url",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="RESTRICT"), nullable=False
    )
    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    job_title: Mapped[str] = mapped_column(String(200), nullable=False)
    job_posting_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    normalized_job_posting_url: Mapped[str] = mapped_column(
        String(2048), nullable=False
    )
    location: Mapped[str] = mapped_column(String(200), nullable=False)
    work_arrangement: Mapped[WorkArrangement] = mapped_column(
        String(20), nullable=False
    )
    employment_type: Mapped[EmploymentType] = mapped_column(String(20), nullable=False)
    application_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[ApplicationStatus] = mapped_column(String(20), nullable=False)
    salary_min: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    salary_max: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    salary_currency: Mapped[str | None] = mapped_column(String(3))
    salary_period: Mapped[SalaryPeriod | None] = mapped_column(String(20))
    job_description: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
