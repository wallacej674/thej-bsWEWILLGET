import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { VerifyEmailPage } from "./VerifyEmailPage";

describe("VerifyEmailPage", () => {
  it("verifies the token from the URL and presents sign in", async () => {
    const verify = vi.fn().mockResolvedValue({ status: "verified" });
    render(
      <MemoryRouter initialEntries={["/verify-email?token=verification-token"]}>
        <VerifyEmailPage onVerify={verify} onResend={vi.fn()} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Email verified" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?verified=true",
    );
    expect(verify).toHaveBeenCalledWith("verification-token");
  });

  it("shows recovery when the link has no token", async () => {
    render(
      <MemoryRouter initialEntries={["/verify-email"]}>
        <VerifyEmailPage onVerify={vi.fn()} onResend={vi.fn()} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Get a new link" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Send a new link" })).toBeVisible();
  });
});
