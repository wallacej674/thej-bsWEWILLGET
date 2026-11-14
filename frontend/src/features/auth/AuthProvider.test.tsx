import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { type AuthContextValue, AuthProvider, useAuth } from "./AuthProvider";
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

  it("lets sign in react once credentials are accepted, before the session loads", async () => {
    const order: string[] = [];
    const client = {
      get: vi.fn((path: string) => {
        order.push(`get ${path}`);
        return Promise.reject({ status: 401 });
      }),
      post: vi.fn((path: string) => {
        order.push(`post ${path}`);
        return Promise.resolve();
      }),
      setAuthenticationFailureHandler: vi.fn(),
    } as unknown as AuthClient;
    let login: AuthContextValue["login"] | undefined;
    function CaptureLogin() {
      const auth = useAuth();
      login = auth.login;
      return <output>{auth.status}</output>;
    }

    render(
      <AuthProvider client={client}>
        <CaptureLogin />
      </AuthProvider>,
    );
    await screen.findByText("unauthenticated");
    order.length = 0;

    await act(async () => {
      await login?.(
        { email: "maya@example.test", password: "a long passphrase" },
        { onAccepted: () => void order.push("accepted") },
      ).catch(() => undefined);
    });

    expect(order.slice(0, 3)).toEqual(["post /auth/login", "accepted", "get /users/me"]);
  });
});
