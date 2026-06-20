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
  WorkspaceInvitation,
  WorkspaceMember,
} from "./types";

export type ApiClient = ReturnType<typeof createApiClient>;

export const sessionApi = {
  currentUser: (client: ApiClient) => client.get<CurrentUser>("/users/me"),
  workspaces: (client: ApiClient) =>
    client.get<{ items: Workspace[] }>("/workspaces"),
};

export const workspaceApi = {
  create: (client: ApiClient, name: string) =>
    client.post<Workspace>("/workspaces", { name }),
  members: (client: ApiClient, workspaceId: string) =>
    client.get<{ items: WorkspaceMember[] }>(
      `/workspaces/${workspaceId}/members`,
    ),
  removeMember: (client: ApiClient, workspaceId: string, userId: string) =>
    client.delete(`/workspaces/${workspaceId}/members/${userId}`),
  updateMemberRole: (
    client: ApiClient,
    workspaceId: string,
    userId: string,
    role: "admin" | "member",
  ) =>
    client.patch<WorkspaceMember>(
      `/workspaces/${workspaceId}/members/${userId}/role`,
      { role },
    ),
  delete: (client: ApiClient, workspaceId: string) =>
    client.delete(`/workspaces/${workspaceId}`),
  invitations: (client: ApiClient, workspaceId: string) =>
    client.get<{ items: WorkspaceInvitation[] }>(
      `/workspaces/${workspaceId}/invitations`,
    ),
  invite: (client: ApiClient, workspaceId: string, email: string) =>
    client.post<WorkspaceInvitation>(
      `/workspaces/${workspaceId}/invitations`,
      { email },
    ),
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
  permanentlyDelete: (
    client: ApiClient,
    workspaceId: string,
    applicationIds: string[],
    deleteAll: boolean,
  ) =>
    client.post<{ deleted_count: number }>(
      `/workspaces/${workspaceId}/applications/deleted/permanent-delete`,
      {
        application_ids: applicationIds,
        delete_all: deleteAll,
      },
    ),
};
