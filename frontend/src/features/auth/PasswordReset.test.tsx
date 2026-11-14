import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/client";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { ResetPasswordPage } from "./ResetPasswordPage";

const NEW = "a brand new passphrase";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderForgot(onRequestReset = vi.fn(() => Promise.resolve({ message: "ok" })), email?: string) {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/forgot-password", state: email ? { email } : null }]}>
      <ForgotPasswordPage onRequestReset={onRequestReset} />
    </MemoryRouter>,
  );
  return onRequestReset;
}

function renderReset(onReset = vi.fn(() => Promise.resolve()), url = "/reset-password?token=abc123") {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/reset-password"
          element={
            <>
              <ResetPasswordPage onReset={onReset} />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return onReset;
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("ForgotPasswordPage", () => {
  it("keeps the email typed on the sign-in page and confirms the request", async () => {
    const request = renderForgot(undefined, "jonathan@example.test");
    expect(screen.getByLabelText("Email address")).toHaveValue("jonathan@example.test");

    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText("jonathan@example.test")).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("jonathan@example.test");
  });

  it("asks for a real email address before sending", () => {
    const request = renderForgot();
    type("Email address", "jonathan@");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter the email address you sign in with.");
    expect(request).not.toHaveBeenCalled();
  });

  it("shows the wait when requests are rate limited", async () => {
    renderForgot(
      vi.fn(() => Promise.reject(new ApiError(429, "rate_limited", "Too many requests. Try again in 45 minutes."))),
      "jonathan@example.test",
    );
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Try again in 45 minutes.");
  });
});

describe("ResetPasswordPage", () => {
  it("takes the token out of the address bar straight away", async () => {
    renderReset();
    expect(await screen.findByTestId("location")).toHaveTextContent(/^\/reset-password$/);
  });

  it("checks length and match before sending", () => {
    const reset = renderReset();
    type("New password", "short");
    type("Confirm new password", "short");
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Use at least 12 characters.");

    type("New password", NEW);
    type("Confirm new password", "something else entirely");
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(reset).not.toHaveBeenCalled();
  });

  it("saves the new password with the token from the link", async () => {
    const reset = renderReset();
    type("New password", NEW);
    type("Confirm new password", NEW);
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));

    expect(await screen.findByRole("heading", { name: "Password updated" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(reset).toHaveBeenCalledWith({ token: "abc123", password: NEW });
  });

  it("offers a new link when this one has expired or been used", async () => {
    renderReset(
      vi.fn(() => Promise.reject(new ApiError(400, "reset_link_invalid", "This reset link is invalid."))),
    );
    type("New password", NEW);
    type("Confirm new password", NEW);
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));

    expect(await screen.findByRole("heading", { name: "This link has expired" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send a new link" })).toHaveAttribute("href", "/forgot-password");
  });

  it("treats a link with no token as expired", () => {
    renderReset(undefined, "/reset-password");
    expect(screen.getByRole("heading", { name: "This link has expired" })).toBeInTheDocument();
  });
});
