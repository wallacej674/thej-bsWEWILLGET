import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";

describe("API client", () => {
  it("sends the selected development identity and parses JSON responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "user-1", display_name: "Jonathan" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createApiClient({
      baseUrl: "http://localhost:8000",
      getUserId: () => "user-1",
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

  it("returns undefined for a successful 204 response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const client = createApiClient({
      baseUrl: "http://localhost:8000/",
      getUserId: () => "user-1",
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
      getUserId: () => "user-1",
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
