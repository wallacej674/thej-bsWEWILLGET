import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./AuthProvider";
import type { AuthClient } from "./authApi";

function AuthStatus() {
  return <output>{useAuth().status}</output>;
}

describe("AuthProvider", () => {
  it("settles on unauthenticated when no cookie session can be restored", async () => {
    const client = {
      get: vi.fn().mockRejectedValue({ status: 401 }),
      post: vi.fn(),
      setAuthenticationFailureHandler: vi.fn(),
    } as unknown as AuthClient;

    render(
      <AuthProvider client={client}>
        <AuthStatus />
      </AuthProvider>,
    );

    expect(screen.getByText("initializing")).toBeVisible();
    expect(await screen.findByText("unauthenticated")).toBeVisible();
  });
});
