import { daysSince } from "../../dashboard/dashboardModel";
import type { ApplicationFilters, EmploymentType, JobApplication, SortField } from "../types";

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
  unknown: "Unknown",
};

export const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "application_date", label: "Date applied" },
  { value: "updated_at", label: "Last updated" },
  { value: "company_name", label: "Company" },
  { value: "job_title", label: "Job title" },
];

const PERIOD_SUFFIX = { hourly: "/hr", monthly: "/mo", yearly: "/yr" } as const;

/** Short salary range such as "$140K–$165K/yr", or null when none is saved. */
export function compactSalary(
  application: Pick<
    JobApplication,
    "salary_min" | "salary_max" | "salary_currency" | "salary_period"
  >,
): string | null {
  const values = [application.salary_min, application.salary_max].filter(
    (value): value is string => Boolean(value),
  );
  if (values.length === 0) return null;
  let format: (value: number) => string;
  try {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: application.salary_currency ?? "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    });
    format = (value) => formatter.format(value);
  } catch {
    format = (value) => String(value);
  }
  const range = values.map((value) => format(Number(value))).join("–");
  return application.salary_period ? `${range}${PERIOD_SUFFIX[application.salary_period]}` : range;
}

/** "today", "yesterday" or "N days ago" for an application date. */
export function sentAgo(applicationDate: string, now: Date = new Date()): string {
  const days = daysSince(applicationDate, now);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** Only the member who logged an application can edit it. */
export function canEditApplication(application: JobApplication, userId: string): boolean {
  return application.owner.id === userId;
}

/** The author, or a workspace owner/admin moderating, can delete it. */
export function canDeleteApplication(
  application: JobApplication,
  userId: string,
  canModerate: boolean,
): boolean {
  return canModerate || application.owner.id === userId;
}

/** The newest application gets the large tile only in the default ordering. */
export function featuresNewest(
  filters: Pick<ApplicationFilters, "page" | "sortBy" | "sortOrder">,
): boolean {
  return filters.page === 1 && filters.sortBy === "application_date" && filters.sortOrder === "desc";
}

export function activeFilterCount(filters: ApplicationFilters): number {
  return [
    filters.search,
    filters.ownerId,
    filters.status,
    filters.workArrangement,
    filters.employmentType,
  ].filter(Boolean).length;
}
