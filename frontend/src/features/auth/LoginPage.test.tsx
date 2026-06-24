import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { LoginPage } from "./LoginPage";

function renderLoginPage(
  onLogin = vi.fn(() => Promise.resolve()),
  initialEntries: string[] = ["/login"],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LoginPage onLogin={onLogin} />
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  it("submits credentials once while the sign-in request is pending", () => {
    const login = vi.fn(() => new Promise<void>(() => undefined));

    renderLoginPage(login);

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

  it("toggles password visibility when the show/hide control is pressed", () => {
    renderLoginPage();

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("shows the verification confirmation when arriving with ?verified=true", () => {
    renderLoginPage(vi.fn(() => Promise.resolve()), ["/login?verified=true"]);

    expect(
      screen.getByText("Email verified. Sign in to continue."),
    ).toBeInTheDocument();
  });

  it("surfaces an error message when sign-in is rejected", async () => {
    const login = vi.fn(() => Promise.reject(new Error("nope")));

    renderLoginPage(login);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "jonathan@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Email or password is incorrect.");
  });

  it("links to account creation", () => {
    renderLoginPage();

    expect(
      screen.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/signup");
  });
});
