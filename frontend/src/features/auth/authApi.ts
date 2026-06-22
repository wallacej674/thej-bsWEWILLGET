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

export interface SignupInput {
  displayName: string;
  email: string;
  password: string;
  workspaceName: string;
}

export interface MessageResponse {
  message: string;
}

export interface VerificationResponse {
  status: "verified";
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
  signup: (client: AuthClient, input: SignupInput) =>
    client.post<MessageResponse>(
      "/auth/signup",
      {
        display_name: input.displayName,
        email: input.email,
        password: input.password,
        workspace_name: input.workspaceName,
      },
      {
        includeCsrf: false,
        retryOnUnauthorized: false,
      },
    ),
  verifyEmail: (client: AuthClient, token: string) =>
    client.post<VerificationResponse>(
      "/auth/verify-email",
      { token },
      {
        includeCsrf: false,
        retryOnUnauthorized: false,
      },
    ),
  resendVerification: (client: AuthClient, email: string) =>
    client.post<MessageResponse>(
      "/auth/resend-verification",
      { email },
      {
        includeCsrf: false,
        retryOnUnauthorized: false,
      },
    ),
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
