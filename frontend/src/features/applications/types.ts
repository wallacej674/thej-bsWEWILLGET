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

export interface ResumeProfile {
  id: string;
  original_filename: string;
  parser_status: "ready" | "warning" | "unreadable";
  parser_warnings: string[];
  extracted_text_preview: string;
  extracted_text_length: number;
  created_at: string;
  updated_at: string;
}

export interface ResumeTailorResult {
  match_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  suggested_summary: string;
  suggested_bullets: string[];
  interview_talking_points: string[];
  caution_notes: string[];
  ats_warnings: string[];
}

export interface ResumeTailorAnalysis {
  id: string;
  application_id: string;
  prompt_version: string;
  provider_name: string;
  model_name: string;
  result: ResumeTailorResult;
  created_at: string;
  updated_at: string;
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

export type JobPostingAutofillFields = Partial<
  Pick<
    ApplicationPayload,
    | "company_name"
    | "job_title"
    | "location"
    | "work_arrangement"
    | "employment_type"
    | "salary_min"
    | "salary_max"
    | "salary_currency"
    | "salary_period"
    | "job_description"
  >
>;

export interface JobPostingAutofillResponse {
  fields: JobPostingAutofillFields;
  source: "greenhouse" | "lever" | "ashby" | "workday" | "json_ld" | "html" | "none";
  warnings: string[];
  field_sources: Record<string, string>;
}

export interface OwnerApplicationCount {
  owner: OwnerSummary;
  count: number;
}

export interface ApplicationsOverTimePoint {
  week_start: string;
  total: number;
}

export interface ApplicationSummary {
  total_active: number;
  current_week: number;
  recently_updated: number;
  deleted: number;
  status_counts: Record<ApplicationStatus, number>;
  work_arrangement_counts: Record<WorkArrangement, number>;
  applications_over_time: ApplicationsOverTimePoint[];
  top_applicants: OwnerApplicationCount[];
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

export type TeamAccountabilitySort =
  | "active"
  | "this_week"
  | "rejected"
  | "last_applied"
  | "name";

export interface TeamAccountabilityRow {
  owner: OwnerSummary;
  active: number;
  this_week: number;
  rejected: number;
  last_applied: string | null;
  weekly_goal: number | null;
}

export interface TeamAccountabilityResponse {
  items: TeamAccountabilityRow[];
  pagination: Pagination;
}

export interface MyWeekPoint {
  week_start: string;
  total: number;
  met_goal: boolean;
}

export interface MyWeekOldestOpen {
  application_id: string;
  company_name: string;
  job_title: string;
  application_date: string;
}

export interface MyWeek {
  weekly_goal: number | null;
  applied_this_week: number;
  streak_weeks: number;
  day_streak: number;
  recent_weeks: MyWeekPoint[];
  oldest_open: MyWeekOldestOpen | null;
}

export interface WorkspaceMemberListResponse {
  items: WorkspaceMember[];
  pagination: Pagination;
  member_count: number;
}

export interface WorkspaceInvitationListResponse {
  items: WorkspaceInvitation[];
  pagination: Pagination;
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
