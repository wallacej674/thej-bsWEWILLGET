import type { CurrentUser, Workspace } from "../applications/types";

/**
 * The small portion of the API client that the authentication boundary owns.
 * It deliberately excludes development-identity concerns and token handling.
 */
export interface AuthClient {
  get<T>(
    path: string,
    query?: Record<string, string | number | undefined | null>,
  ): Promise<T>;
  post<T>(
    path: string,
    body?: unknown,
    behavior?: AuthRequestBehavior,
  ): Promise<T>;
  setAuthenticationFailureHandler(
    handler: (() => void) | undefined,
  ): void;
}

export interface AuthRequestBehavior {
  includeCsrf?: boolean;
  retryOnUnauthorized?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AuthenticatedSession {
  user: CurrentUser;
  workspace: Workspace;
}

export const authApi = {
  currentUser: (client: AuthClient) => client.get<CurrentUser>("/users/me"),
  workspaces: (client: AuthClient) =>
    client.get<{ items: Workspace[] }>("/workspaces"),
  login: (client: AuthClient, credentials: LoginCredentials) =>
    client.post<void>("/auth/login", credentials, {
      includeCsrf: false,
      retryOnUnauthorized: false,
    }),
  logout: (client: AuthClient) =>
    client.post<void>("/auth/logout", undefined, {
      retryOnUnauthorized: false,
    }),
  changePassword: (client: AuthClient, input: ChangePasswordInput) =>
    client.post<void>("/auth/change-password", {
      current_password: input.currentPassword,
      new_password: input.newPassword,
    }),
};
