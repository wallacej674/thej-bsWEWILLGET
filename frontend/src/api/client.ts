export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: unknown;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface CsrfConfig {
  cookieName: string;
  headerName: string;
  readCookie: (name: string) => string | null;
}

interface ApiClientOptions {
  baseUrl: string;
  developmentIdentity?: {
    enabled: boolean;
    getUserId: () => string | null;
  };
  csrf?: CsrfConfig;
  refreshCsrf?: CsrfConfig;
  fetcher?: typeof fetch;
}

interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  includeCsrf?: boolean;
  retryOnUnauthorized?: boolean;
}

type RequestBehavior = Pick<RequestOptions, "includeCsrf" | "retryOnUnauthorized">;

function buildUrl(
  baseUrl: string,
  path: string,
  query?: RequestOptions["query"],
): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const apiBase =
    normalizedBase === "/api"
      ? "/api/v1"
      : `${normalizedBase}/api/v1`;
  const url = new URL(`${apiBase}${normalizedPath}`, window.location.origin);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return normalizedBase === "/api"
    ? `${url.pathname}${url.search}`
    : url.toString();
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const error = value.error;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

export function createApiClient({
  baseUrl,
  developmentIdentity,
  csrf,
  refreshCsrf,
  fetcher = fetch,
}: ApiClientOptions) {
  let refreshInFlight: Promise<void> | null = null;
  let authenticationFailureHandler: ((error: ApiError) => void) | undefined;

  async function execute<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const userId = developmentIdentity?.enabled
      ? developmentIdentity.getUserId()
      : null;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (userId) {
      headers["X-User-Id"] = userId;
    }
    const csrfConfig = path === "/auth/refresh" ? refreshCsrf ?? csrf : csrf;
    if (
      csrfConfig &&
      options.includeCsrf !== false &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(method)
    ) {
      const csrfToken = csrfConfig.readCookie(csrfConfig.cookieName);
      if (csrfToken) {
        headers[csrfConfig.headerName] = csrfToken;
      }
    }
  if (options.body !== undefined) {
      if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }
    }

    let response: Response;
    try {
      response = await fetcher(buildUrl(baseUrl, path, options.query), {
        method,
        headers,
        credentials: "include",
        body:
          options.body === undefined
            ? undefined
            : options.body instanceof FormData
              ? options.body
              : JSON.stringify(options.body),
      });
    } catch (error) {
      throw new ApiError(
        0,
        "network_error",
        "The API could not be reached. Check that the backend is running.",
        error,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    const payload: unknown = contentType.includes("application/json")
      ? await response.json()
      : null;

    if (!response.ok) {
      if (isErrorEnvelope(payload)) {
        throw new ApiError(
          response.status,
          payload.error.code,
          payload.error.message,
          payload.error.details,
        );
      }
      throw new ApiError(
        response.status,
        "unexpected_response",
        "The API returned an unexpected response.",
      );
    }

    return payload as T;
  }

  function isAuthenticationEndpoint(path: string): boolean {
    return [
      "/auth/login",
      "/auth/refresh",
      "/auth/logout",
      "/auth/signup",
      "/auth/verify-email",
      "/auth/resend-verification",
    ].includes(path);
  }

  async function refresh(): Promise<void> {
    if (!refreshInFlight) {
      refreshInFlight = execute<void>("POST", "/auth/refresh").finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  async function request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    try {
      return await execute<T>(method, path, options);
    } catch (error) {
      const shouldRefresh =
        error instanceof ApiError &&
        error.status === 401 &&
        options.retryOnUnauthorized !== false &&
        !isAuthenticationEndpoint(path);

      if (!shouldRefresh) {
        throw error;
      }

      try {
        await refresh();
      } catch {
        authenticationFailureHandler?.(error);
        throw error;
      }

      return execute<T>(method, path, options);
    }
  }

  return {
    get: <T>(path: string, query?: RequestOptions["query"]) =>
      request<T>("GET", path, { query }),
    post: <T>(path: string, body?: unknown, behavior?: RequestBehavior) =>
      request<T>("POST", path, { body, ...behavior }),
    patch: <T>(path: string, body: unknown) =>
      request<T>("PATCH", path, { body }),
    delete: (path: string) => request<void>("DELETE", path),
    login: (credentials: { email: string; password: string }) =>
      request<void>("POST", "/auth/login", {
        body: credentials,
        includeCsrf: false,
        retryOnUnauthorized: false,
      }),
    refresh,
    logout: () => request<void>("POST", "/auth/logout", { retryOnUnauthorized: false }),
    setAuthenticationFailureHandler: (
      handler: ((error: ApiError) => void) | undefined,
    ) => {
      authenticationFailureHandler = handler;
    },
  };
}
