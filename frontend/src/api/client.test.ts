import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";

describe("API client", () => {
  it("sends requests with browser credentials", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "user-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createApiClient({
      baseUrl: "http://localhost:8000",
      fetcher,
    });

    await client.get("/users/me");

    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/users/me",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("sends a development identity only when the adapter is explicitly enabled", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "user-1", display_name: "Jonathan" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createApiClient({
      baseUrl: "http://localhost:8000",
      developmentIdentity: {
        enabled: true,
        getUserId: () => "user-1",
      },
      fetcher,
    });

    const user = await client.get<{ id: string; display_name: string }>("/users/me");

    expect(user.display_name).toBe("Jonathan");
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/users/me",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-User-Id": "user-1" }),
      }),
    );
  });

  it("omits the development identity header in normal mode", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "user-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createApiClient({
      baseUrl: "http://localhost:8000",
      fetcher,
    });

    await client.get("/users/me");

    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/users/me",
      expect.objectContaining({
        headers: expect.not.objectContaining({ "X-User-Id": expect.anything() }),
      }),
    );
  });

  it("sends the configured CSRF header only for unsafe requests", async () => {
    const readCookie = vi.fn(() => "csrf-value");
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
      new Response(JSON.stringify({ id: "application-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createApiClient({
      baseUrl: "http://localhost:8000",
      csrf: {
        cookieName: "apply-together-csrf",
        headerName: "X-ApplyTogether-CSRF",
        readCookie,
      },
      fetcher,
    });

    await client.get("/users/me");
    await client.post("/workspaces/workspace-1/applications", { company_name: "Acme" });

    expect(readCookie).toHaveBeenCalledTimes(1);
    expect(readCookie).toHaveBeenCalledWith("apply-together-csrf");
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8000/api/v1/users/me",
      expect.objectContaining({
        headers: expect.not.objectContaining({ "X-ApplyTogether-CSRF": expect.anything() }),
      }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8000/api/v1/workspaces/workspace-1/applications",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-ApplyTogether-CSRF": "csrf-value" }),
      }),
    );
  });

  it("refreshes once and retries an eligible unauthorized request", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "unauthorized", message: "Expired", details: null } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "user-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = createApiClient({ baseUrl: "http://localhost:8000", fetcher });

    await expect(client.get<{ id: string }>("/users/me")).resolves.toEqual({ id: "user-1" });

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:8000/api/v1/users/me",
      "http://localhost:8000/api/v1/auth/refresh",
      "http://localhost:8000/api/v1/users/me",
    ]);
  });

  it("shares one refresh operation across concurrent unauthorized requests", async () => {
    let resolveRefresh: ((response: Response) => void) | undefined;
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    const fetcher = vi.fn<typeof fetch>((input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        return refreshResponse;
      }
      if (url.endsWith("/users/me") || url.endsWith("/workspaces")) {
        const count = fetcher.mock.calls.filter(([calledUrl]) => String(calledUrl) === url).length;
        if (count === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: { code: "unauthorized", message: "Expired", details: null } }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ id: url.endsWith("/users/me") ? "user-1" : "workspace-1" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const client = createApiClient({ baseUrl: "http://localhost:8000", fetcher });

    const userRequest = client.get<{ id: string }>("/users/me");
    const workspaceRequest = client.get<{ id: string }>("/workspaces");

    await vi.waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(3);
    });
    resolveRefresh?.(new Response(null, { status: 204 }));

    await expect(Promise.all([userRequest, workspaceRequest])).resolves.toEqual([
      { id: "user-1" },
      { id: "workspace-1" },
    ]);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh"))).toHaveLength(1);
  });

  it("does not refresh login, refresh, or logout requests", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
      new Response(JSON.stringify({ error: { code: "unauthorized", message: "Unauthorized", details: null } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createApiClient({ baseUrl: "http://localhost:8000", fetcher });

    await expect(client.login({ email: "jonathan@example.test", password: "incorrect" })).rejects.toMatchObject({
      code: "unauthorized",
      status: 401,
    });
    await expect(client.refresh()).rejects.toMatchObject({ code: "unauthorized", status: 401 });
    await expect(client.logout()).rejects.toMatchObject({ code: "unauthorized", status: 401 });

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:8000/api/v1/auth/login",
      "http://localhost:8000/api/v1/auth/refresh",
      "http://localhost:8000/api/v1/auth/logout",
    ]);
  });

  it("notifies the authentication boundary but preserves the original error when refresh fails", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "access_expired", message: "Access expired", details: null } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: "session_revoked", message: "Session revoked", details: null } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = createApiClient({ baseUrl: "http://localhost:8000", fetcher });
    const onFailure = vi.fn();
    client.setAuthenticationFailureHandler(onFailure);

    await expect(client.get("/users/me")).rejects.toMatchObject({
      code: "access_expired",
      message: "Access expired",
      status: 401,
    });

    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({ code: "access_expired", status: 401 }),
    );
  });

  it("returns undefined for a successful 204 response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const client = createApiClient({
      baseUrl: "http://localhost:8000/",
      fetcher,
    });

    await expect(client.delete("/workspaces/workspace-1/applications/app-1"))
      .resolves.toBeUndefined();
  });

  it("throws the backend error envelope without losing validation details", async () => {
    const details = [{ loc: ["body", "company_name"], msg: "Field required" }];
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "validation_error",
            message: "Request validation failed.",
            details,
          },
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = createApiClient({
      baseUrl: "http://localhost:8000",
      fetcher,
    });

    await expect(client.post("/workspaces/workspace-1/applications", {}))
      .rejects.toEqual(
        expect.objectContaining({
          code: "validation_error",
          message: "Request validation failed.",
          details,
          status: 422,
        }),
      );
  });
});
