import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/client";
import type { LoginCredentials } from "./authApi";
import type { LoginOptions } from "./AuthProvider";
import { LoginPage } from "./LoginPage";

function renderLoginPage(
  onLogin: ComponentProps<typeof LoginPage>["onLogin"] = vi.fn(() => Promise.resolve()),
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
    expect(login).toHaveBeenCalledWith(
      {
        email: "jonathan@example.test",
        password: "correct horse battery staple",
      },
      expect.objectContaining({ onAccepted: expect.any(Function) }),
    );
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

  it("fills the goal ring and coaches each step as the form is completed", () => {
    renderLoginPage();
    const ring = screen.getByTestId("goal-ring-fill");

    expect(ring).toHaveAttribute("data-progress", "0");
    expect(screen.getByText("Start with your email.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "jonathan@example.test" },
    });
    expect(ring).toHaveAttribute("data-progress", "0.5");
    expect(screen.getByText("Now your password.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    expect(ring).toHaveAttribute("data-progress", "1");
    expect(screen.getByText("Ready when you are.")).toBeInTheDocument();
  });

  it("closes the ring once the credentials are accepted", async () => {
    const login = vi.fn(async (_credentials: LoginCredentials, options?: LoginOptions) => {
      await options?.onAccepted?.();
      await new Promise<void>(() => undefined);
    });
    renderLoginPage(login);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "jonathan@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    });

    expect(await screen.findByRole("button", { name: "Signed in" })).toBeDisabled();
    expect(screen.getByText("You're in. Opening your week…")).toBeInTheDocument();
    expect(screen.getByTestId("goal-ring-fill")).toHaveAttribute("data-progress", "1");
  });

  it("asks for another try after a rejected attempt", async () => {
    renderLoginPage(vi.fn(() => Promise.reject(new Error("nope"))));

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "jonathan@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("That didn't match. Try again.")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("says how long to wait when sign in is throttled", async () => {
    renderLoginPage(
      vi.fn(() =>
        Promise.reject(
          new ApiError(429, "login_throttled", "Too many sign-in attempts. Try again in 2 minutes."),
        ),
      ),
    );

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "jonathan@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many sign-in attempts. Try again in 2 minutes.",
    );
    expect(screen.getByText("Too many tries. Take a short break.")).toBeInTheDocument();
  });

  it("links the logo back home", () => {
    renderLoginPage();

    expect(screen.getByRole("link", { name: "ApplyTogether home" })).toHaveAttribute("href", "/");
  });

  it("links to account creation", () => {
    renderLoginPage();

    expect(
      screen.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/signup");
  });
});
