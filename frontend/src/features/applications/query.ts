import type { ApplicationFilters } from "./types";

export function buildApplicationQuery(filters: ApplicationFilters) {
  return {
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.ownerId ? { owner_id: filters.ownerId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.workArrangement
      ? { work_arrangement: filters.workArrangement }
      : {}),
    ...(filters.employmentType
      ? { employment_type: filters.employmentType }
      : {}),
    sort_by: filters.sortBy,
    sort_order: filters.sortOrder,
    page: filters.page,
    page_size: filters.pageSize,
  };
}
