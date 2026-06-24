from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.enums import (
    ApplicationStatus,
    EmploymentType,
    SalaryPeriod,
    WorkArrangement,
)
from app.core.url_normalization import normalize_job_posting_url
from app.models.application import JobApplication
from app.models.user import User


def _trim(value: str) -> str:
    return value.strip()


def _normalize_currency(value: str | None) -> str | None:
    if value is None:
        return None
    currency = value.upper()
    if len(currency) != 3 or not currency.isascii() or not currency.isalpha():
        raise ValueError("salary_currency must be a three-letter code")
    return currency


class ApplicationCreate(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    job_title: str = Field(min_length=1, max_length=200)
    job_posting_url: str = Field(min_length=1, max_length=2048)
    location: str = Field(min_length=1, max_length=200)
    work_arrangement: WorkArrangement
    employment_type: EmploymentType
    application_date: date | None = None
    status: ApplicationStatus = ApplicationStatus.APPLIED
    salary_min: Decimal | None = Field(
        default=None, ge=0, max_digits=12, decimal_places=2
    )
    salary_max: Decimal | None = Field(
        default=None, ge=0, max_digits=12, decimal_places=2
    )
    salary_currency: str | None = Field(default="USD", min_length=3, max_length=3)
    salary_period: SalaryPeriod | None = None
    job_description: str | None = Field(default=None, max_length=20_000)
    notes: str | None = Field(default=None, max_length=5_000)

    @field_validator(
        "company_name", "job_title", "job_posting_url", "location", mode="before"
    )
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        return _trim(value)

    @field_validator("job_posting_url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        normalize_job_posting_url(value)
        return value

    @field_validator("salary_currency")
    @classmethod
    def normalize_currency(cls, value: str | None) -> str | None:
        return _normalize_currency(value)

    @field_validator("job_description", "notes")
    @classmethod
    def trim_optional_text(cls, value: str | None) -> str | None:
        return _trim(value) if value is not None else None

    @model_validator(mode="after")
    def validate_salary(self) -> Self:
        if self.salary_min is not None and self.salary_max is not None:
            if self.salary_min > self.salary_max:
                raise ValueError("salary_min cannot exceed salary_max")
        if (self.salary_min is not None or self.salary_max is not None) and (
            self.salary_period is None
        ):
            raise ValueError("salary_period is required when salary is provided")
        return self


class JobPostingAutofillRequest(BaseModel):
    job_posting_url: str = Field(min_length=1, max_length=2048)

    @field_validator("job_posting_url", mode="before")
    @classmethod
    def trim_url(cls, value: str) -> str:
        return _trim(value)


class JobPostingAutofillFields(BaseModel):
    company_name: str | None = None
    job_title: str | None = None
    location: str | None = None
    work_arrangement: WorkArrangement | None = None
    employment_type: EmploymentType | None = None
    salary_min: Decimal | None = None
    salary_max: Decimal | None = None
    salary_currency: str | None = None
    salary_period: SalaryPeriod | None = None
    job_description: str | None = None


class JobPostingAutofillResponse(BaseModel):
    fields: JobPostingAutofillFields
    source: Literal[
        "greenhouse", "lever", "ashby", "workday", "json_ld", "html", "none"
    ]
    warnings: list[str] = Field(default_factory=list)
    field_sources: dict[str, str] = Field(default_factory=dict)


class ApplicationUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=1, max_length=200)
    job_title: str | None = Field(default=None, min_length=1, max_length=200)
    job_posting_url: str | None = Field(default=None, min_length=1, max_length=2048)
    location: str | None = Field(default=None, min_length=1, max_length=200)
    work_arrangement: WorkArrangement | None = None
    employment_type: EmploymentType | None = None
    application_date: date | None = None
    status: ApplicationStatus | None = None
    salary_min: Decimal | None = Field(
        default=None, ge=0, max_digits=12, decimal_places=2
    )
    salary_max: Decimal | None = Field(
        default=None, ge=0, max_digits=12, decimal_places=2
    )
    salary_currency: str | None = Field(default=None, min_length=3, max_length=3)
    salary_period: SalaryPeriod | None = None
    job_description: str | None = Field(default=None, max_length=20_000)
    notes: str | None = Field(default=None, max_length=5_000)

    @field_validator(
        "company_name", "job_title", "job_posting_url", "location", mode="before"
    )
    @classmethod
    def trim_supplied_required_text(cls, value: str | None) -> str | None:
        return _trim(value) if value is not None else None

    @field_validator("job_posting_url")
    @classmethod
    def validate_supplied_url(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("job_posting_url cannot be null")
        normalize_job_posting_url(value)
        return value

    @field_validator("application_date")
    @classmethod
    def validate_supplied_application_date(cls, value: date | None) -> date | None:
        if value is None:
            raise ValueError("application_date cannot be null")
        return value

    @field_validator("salary_currency")
    @classmethod
    def normalize_supplied_currency(cls, value: str | None) -> str | None:
        return _normalize_currency(value)

    @field_validator("job_description", "notes")
    @classmethod
    def trim_supplied_optional_text(cls, value: str | None) -> str | None:
        return _trim(value) if value is not None else None


class ApplicationOwner(BaseModel):
    id: UUID
    display_name: str
    avatar_url: str | None

    @classmethod
    def from_user(cls, user: User) -> "ApplicationOwner":
        return cls(
            id=user.id, display_name=user.display_name, avatar_url=user.avatar_url
        )


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    company_name: str
    job_title: str
    job_posting_url: str
    location: str
    work_arrangement: WorkArrangement
    employment_type: EmploymentType
    application_date: date
    status: ApplicationStatus
    salary_min: Decimal | None
    salary_max: Decimal | None
    salary_currency: str | None
    salary_period: SalaryPeriod | None
    job_description: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    owner: ApplicationOwner

    @classmethod
    def from_application(
        cls, application: JobApplication, owner: User
    ) -> "ApplicationResponse":
        return cls(
            id=application.id,
            workspace_id=application.workspace_id,
            company_name=application.company_name,
            job_title=application.job_title,
            job_posting_url=application.job_posting_url,
            location=application.location,
            work_arrangement=application.work_arrangement,
            employment_type=application.employment_type,
            application_date=application.application_date,
            status=application.status,
            salary_min=application.salary_min,
            salary_max=application.salary_max,
            salary_currency=application.salary_currency,
            salary_period=application.salary_period,
            job_description=application.job_description,
            notes=application.notes,
            created_at=application.created_at,
            updated_at=application.updated_at,
            owner=ApplicationOwner.from_user(owner),
        )


class Pagination(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int


class ApplicationListResponse(BaseModel):
    items: list[ApplicationResponse]
    pagination: Pagination


class ApplicationOwnerSummary(BaseModel):
    owner: ApplicationOwner
    count: int


class ApplicationsOverTimePoint(BaseModel):
    week_start: date
    by_owner: list[ApplicationOwnerSummary]


class RecentApplicationActivity(BaseModel):
    application_id: UUID
    company_name: str
    job_title: str
    owner: ApplicationOwner
    action: Literal["added", "updated"]
    occurred_at: datetime
    status: ApplicationStatus


class ApplicationSummaryResponse(BaseModel):
    total_active: int
    current_month: int
    recently_updated: int
    by_owner: list[ApplicationOwnerSummary]
    status_counts: dict[ApplicationStatus, int]
    work_arrangement_counts: dict[WorkArrangement, int]
    applications_over_time: list[ApplicationsOverTimePoint]
    recent_activity: list[RecentApplicationActivity]


class DeletedApplicationResponse(ApplicationResponse):
    deleted_at: datetime
    deleted_by: ApplicationOwner
    moderated: bool

    @classmethod
    def from_deleted_application(
        cls, application: JobApplication, owner: User, deleted_by: User
    ) -> "DeletedApplicationResponse":
        response = ApplicationResponse.from_application(application, owner).model_dump()
        if application.deleted_at is None:
            raise ValueError("Deleted application response requires deleted_at")
        return cls(
            **response,
            deleted_at=application.deleted_at,
            deleted_by=ApplicationOwner.from_user(deleted_by),
            moderated=deleted_by.id != owner.id,
        )


class DeletedApplicationListResponse(BaseModel):
    items: list[DeletedApplicationResponse]
    pagination: Pagination


class PermanentDeleteRequest(BaseModel):
    application_ids: list[UUID] = Field(default_factory=list, max_length=100)
    delete_all: bool = False

    @model_validator(mode="after")
    def validate_selection(self) -> Self:
        if self.delete_all and self.application_ids:
            raise ValueError("application_ids must be empty when delete_all is true")
        if not self.delete_all and not self.application_ids:
            raise ValueError("Select at least one application")
        if len(set(self.application_ids)) != len(self.application_ids):
            raise ValueError("application_ids must be unique")
        return self


class PermanentDeleteResponse(BaseModel):
    deleted_count: int
