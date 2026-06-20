from enum import StrEnum


class MembershipRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class ApplicationStatus(StrEnum):
    APPLIED = "applied"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    CLOSED = "closed"


class WorkArrangement(StrEnum):
    REMOTE = "remote"
    HYBRID = "hybrid"
    ONSITE = "onsite"
    UNKNOWN = "unknown"


class EmploymentType(StrEnum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERNSHIP = "internship"
    TEMPORARY = "temporary"
    UNKNOWN = "unknown"


class SalaryPeriod(StrEnum):
    HOURLY = "hourly"
    MONTHLY = "monthly"
    YEARLY = "yearly"
