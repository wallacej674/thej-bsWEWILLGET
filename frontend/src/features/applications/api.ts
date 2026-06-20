import type { createApiClient } from "../../api/client";
import { buildApplicationQuery } from "./query";
import type {
  ApplicationFilters,
  ApplicationPayload,
  ApplicationSummary,
  ApplicationUpdate,
  CurrentUser,
  DeletedApplication,
  JobApplication,
  PaginatedApplications,
  Workspace,
} from "./types";

export type ApiClient = ReturnType<typeof createApiClient>;

export const sessionApi = {
  currentUser: (client: ApiClient) => client.get<CurrentUser>("/users/me"),
  workspaces: (client: ApiClient) =>
    client.get<{ items: Workspace[] }>("/workspaces"),
};

export const applicationsApi = {
  list: (client: ApiClient, workspaceId: string, filters: ApplicationFilters) =>
    client.get<PaginatedApplications>(
      `/workspaces/${workspaceId}/applications`,
      buildApplicationQuery(filters),
    ),
  summary: (client: ApiClient, workspaceId: string) =>
    client.get<ApplicationSummary>(
      `/workspaces/${workspaceId}/applications/summary`,
    ),
  get: (client: ApiClient, workspaceId: string, applicationId: string) =>
    client.get<JobApplication>(
      `/workspaces/${workspaceId}/applications/${applicationId}`,
    ),
  create: (
    client: ApiClient,
    workspaceId: string,
    payload: ApplicationPayload,
  ) =>
    client.post<JobApplication>(
      `/workspaces/${workspaceId}/applications`,
      payload,
    ),
  update: (
    client: ApiClient,
    workspaceId: string,
    applicationId: string,
    payload: ApplicationUpdate,
  ) =>
    client.patch<JobApplication>(
      `/workspaces/${workspaceId}/applications/${applicationId}`,
      payload,
    ),
  delete: (client: ApiClient, workspaceId: string, applicationId: string) =>
    client.delete(
      `/workspaces/${workspaceId}/applications/${applicationId}`,
    ),
  deleted: (
    client: ApiClient,
    workspaceId: string,
    page: number,
    pageSize: number,
  ) =>
    client.get<PaginatedApplications<DeletedApplication>>(
      `/workspaces/${workspaceId}/applications/deleted`,
      { page, page_size: pageSize },
    ),
  restore: (client: ApiClient, workspaceId: string, applicationId: string) =>
    client.post<JobApplication>(
      `/workspaces/${workspaceId}/applications/${applicationId}/restore`,
    ),
};
