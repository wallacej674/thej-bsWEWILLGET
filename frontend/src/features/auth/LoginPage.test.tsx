import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { LoginPage } from "./LoginPage";

describe("LoginPage", () => {
  it("submits credentials once while the sign-in request is pending", () => {
    const login = vi.fn(() => new Promise<void>(() => undefined));

    render(
      <MemoryRouter>
        <LoginPage onLogin={login} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "jonathan@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(screen.getByRole("button", { name: "Signing in…" }));

    expect(login).toHaveBeenCalledOnce();
    expect(login).toHaveBeenCalledWith({
      email: "jonathan@example.test",
      password: "correct horse battery staple",
    });
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  });
});
