import { describe, expect, it, vi } from "vitest";

import { authApi, type AuthClient } from "./authApi";

describe("authentication API", () => {
  it("submits credentials without CSRF or automatic refresh recovery", async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const client = { post } as unknown as AuthClient;

    await authApi.login(client, {
      email: "person@example.com",
      password: "not-a-token",
    });

    expect(post).toHaveBeenCalledWith(
      "/auth/login",
      { email: "person@example.com", password: "not-a-token" },
      { includeCsrf: false, retryOnUnauthorized: false },
    );
  });
});
