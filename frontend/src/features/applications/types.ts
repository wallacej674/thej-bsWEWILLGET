export type ApplicationStatus = "applied" | "rejected" | "withdrawn" | "closed";
export type WorkArrangement = "remote" | "hybrid" | "onsite" | "unknown";
export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "internship"
  | "temporary"
  | "unknown";
export type SalaryPeriod = "hourly" | "monthly" | "yearly";
export type SortField =
  | "application_date"
  | "created_at"
  | "updated_at"
  | "company_name"
  | "job_title";

export interface CurrentUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface OwnerSummary {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
}

export interface WorkspaceMember {
  user: CurrentUser & { email: string };
  role: "owner" | "admin" | "member";
  joined_at: string;
}

export interface WorkspaceInvitation {
  id: string;
  email: string;
  role: "member";
  status: "pending";
  invited_at: string;
}

export interface InvitationInboxItem {
  id: string;
  workspace: {
    id: string;
    name: string;
  };
  invited_by: {
    display_name: string;
  };
  invited_at: string;
}

export interface JobApplication {
  id: string;
  workspace_id: string;
  company_name: string;
  job_title: string;
  job_posting_url: string;
  location: string;
  work_arrangement: WorkArrangement;
  employment_type: EmploymentType;
  application_date: string;
  status: ApplicationStatus;
  salary_min: string | null;
  salary_max: string | null;
  salary_currency: string | null;
  salary_period: SalaryPeriod | null;
  job_description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  owner: OwnerSummary;
}

export interface DeletedApplication extends JobApplication {
  deleted_at: string;
  deleted_by: OwnerSummary;
  moderated: boolean;
}

export interface Pagination {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface PaginatedApplications<T = JobApplication> {
  items: T[];
  pagination: Pagination;
}

export interface ApplicationPayload {
  company_name: string;
  job_title: string;
  job_posting_url: string;
  location: string;
  work_arrangement: WorkArrangement;
  employment_type: EmploymentType;
  application_date?: string;
  status: ApplicationStatus;
  salary_min?: string | null;
  salary_max?: string | null;
  salary_currency?: string | null;
  salary_period?: SalaryPeriod | null;
  job_description?: string | null;
  notes?: string | null;
}

export type ApplicationUpdate = Partial<ApplicationPayload>;

export interface OwnerApplicationCount {
  owner: OwnerSummary;
  count: number;
}

export interface ApplicationSummary {
  total_active: number;
  current_month: number;
  recently_updated: number;
  by_owner: OwnerApplicationCount[];
  status_counts: Record<ApplicationStatus, number>;
  work_arrangement_counts: Record<WorkArrangement, number>;
  applications_over_time: {
    week_start: string;
    by_owner: OwnerApplicationCount[];
  }[];
  recent_activity: {
    application_id: string;
    company_name: string;
    job_title: string;
    owner: OwnerSummary;
    action: "added" | "updated";
    occurred_at: string;
    status: ApplicationStatus;
  }[];
}

export interface ApplicationFilters {
  search: string;
  ownerId: string;
  status: ApplicationStatus | "";
  workArrangement: WorkArrangement | "";
  employmentType: EmploymentType | "";
  sortBy: SortField;
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: number;
}
