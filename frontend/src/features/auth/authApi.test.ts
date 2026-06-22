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

  it("keeps signup and verification requests public", async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const client = { post } as unknown as AuthClient;

    await authApi.signup(client, {
      displayName: "Amara Ellis",
      email: "amara@example.com",
      password: "correct horse battery staple",
      workspaceName: "Amara's search",
    });
    await authApi.verifyEmail(client, "verification-token");
    await authApi.resendVerification(client, "amara@example.com");

    const publicBehavior = {
      includeCsrf: false,
      retryOnUnauthorized: false,
    };
    expect(post).toHaveBeenNthCalledWith(
      1,
      "/auth/signup",
      {
        display_name: "Amara Ellis",
        email: "amara@example.com",
        password: "correct horse battery staple",
        workspace_name: "Amara's search",
      },
      publicBehavior,
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/auth/verify-email",
      { token: "verification-token" },
      publicBehavior,
    );
    expect(post).toHaveBeenNthCalledWith(
      3,
      "/auth/resend-verification",
      { email: "amara@example.com" },
      publicBehavior,
    );
  });
});
