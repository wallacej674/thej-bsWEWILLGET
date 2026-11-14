import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { SignedOutRoutes } from "./SignedOutRoutes";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SignedOutRoutes
        onLogin={vi.fn(() => Promise.resolve())}
        onSignup={vi.fn(() => Promise.resolve({ message: "ok" }))}
        onResend={vi.fn(() => Promise.resolve({ message: "ok" }))}
      />
    </MemoryRouter>,
  );
}

describe("SignedOutRoutes", () => {
  it("shows the landing page at /", () => {
    renderAt("/");

    expect(
      screen.getByRole("heading", { level: 1, name: /Stay accountable, present and active/ }),
    ).toBeInTheDocument();
  });

  it("shows sign in at /login, with the logo linking home", () => {
    renderAt("/login");

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ApplyTogether home" })).toHaveAttribute("href", "/");
  });

  it("asks for sign in on any app page", () => {
    renderAt("/applications");

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });
});
