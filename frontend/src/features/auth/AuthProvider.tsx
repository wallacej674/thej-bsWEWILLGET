import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  authApi,
  type AuthClient,
  type AuthenticatedSession,
  type ChangePasswordInput,
  type LoginCredentials,
  type MessageResponse,
  type SignupInput,
  type VerificationResponse,
} from "./authApi";

export type AuthStatus =
  | "initializing"
  | "authenticated"
  | "unauthenticated"
  | "recoverable-error";

export interface AuthState {
  status: AuthStatus;
  user?: AuthenticatedSession["user"];
  workspace?: AuthenticatedSession["workspace"];
  error?: unknown;
}

export interface AuthContextValue extends AuthState {
  client: AuthClient;
  login(credentials: LoginCredentials): Promise<void>;
  signup(input: SignupInput): Promise<MessageResponse>;
  verifyEmail(token: string): Promise<VerificationResponse>;
  resendVerification(email: string): Promise<MessageResponse>;
  logout(): Promise<void>;
  changePassword(input: ChangePasswordInput): Promise<void>;
  retry(): Promise<void>;
}

interface AuthProviderProps {
  client: AuthClient;
  children: ReactNode;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isUnauthorized(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 401
  );
}

function missingWorkspaceError(): Error {
  return new Error("Your account does not have an accessible workspace.");
}

export function AuthProvider({ client, children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: "initializing" });
  const restoreSequence = useRef(0);
  const loginInFlight = useRef<Promise<void> | null>(null);

  const clearAuthenticatedState = useCallback(() => {
    restoreSequence.current += 1;
    setState({ status: "unauthenticated" });
  }, []);

  const restoreSession = useCallback(async (): Promise<void> => {
    const sequence = ++restoreSequence.current;
    setState({ status: "initializing" });

    try {
      // The user lookup intentionally precedes the workspace request: neither
      // application data nor workspace membership is requested before auth.
      const user = await authApi.currentUser(client);
      const workspaces = await authApi.workspaces(client);
      const workspace = workspaces.items[0];

      if (!workspace) {
        throw missingWorkspaceError();
      }
      if (sequence !== restoreSequence.current) return;

      setState({ status: "authenticated", user, workspace });
    } catch (error) {
      if (sequence !== restoreSequence.current) return;
      setState(
        isUnauthorized(error)
          ? { status: "unauthenticated" }
          : { status: "recoverable-error", error },
      );
    }
  }, [client]);

  const login = useCallback(
    (credentials: LoginCredentials): Promise<void> => {
      if (loginInFlight.current) return loginInFlight.current;

      const attempt = (async () => {
        try {
          await authApi.login(client, credentials);
          await restoreSession();
        } finally {
          loginInFlight.current = null;
        }
      })();

      loginInFlight.current = attempt;
      return attempt;
    },
    [client, restoreSession],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout(client);
    } finally {
      clearAuthenticatedState();
    }
  }, [client, clearAuthenticatedState]);

  const signup = useCallback(
    (input: SignupInput) => authApi.signup(client, input),
    [client],
  );

  const verifyEmail = useCallback(
    (token: string) => authApi.verifyEmail(client, token),
    [client],
  );

  const resendVerification = useCallback(
    (email: string) => authApi.resendVerification(client, email),
    [client],
  );

  const changePassword = useCallback(
    async (input: ChangePasswordInput): Promise<void> => {
      await authApi.changePassword(client, input);
      // A successful change revokes server sessions, so the next view must be
      // the sign-in boundary even if the old access cookie remains briefly.
      clearAuthenticatedState();
    },
    [client, clearAuthenticatedState],
  );

  useEffect(() => {
    client.setAuthenticationFailureHandler(clearAuthenticatedState);
    return () => client.setAuthenticationFailureHandler(undefined);
  }, [client, clearAuthenticatedState]);

  useEffect(() => {
    void restoreSession();
    return () => {
      restoreSequence.current += 1;
    };
  }, [restoreSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      client,
      login,
      signup,
      verifyEmail,
      resendVerification,
      logout,
      changePassword,
      retry: restoreSession,
    }),
    [
      changePassword,
      client,
      login,
      logout,
      resendVerification,
      restoreSession,
      signup,
      state,
      verifyEmail,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// This hook intentionally shares the provider module so the authentication
// boundary keeps one public import surface.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
