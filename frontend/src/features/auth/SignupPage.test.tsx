import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { SignupPage } from "./SignupPage";

describe("SignupPage", () => {
  it("validates the form before signup", async () => {
    const signup = vi.fn();
    render(
      <MemoryRouter>
        <SignupPage onSignup={signup} onResend={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Amara Ellis" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "amara@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "different" },
    });
    fireEvent.change(screen.getByLabelText("Workspace name"), {
      target: { value: "Amara's search" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Use at least 12 characters.")).toBeVisible();
    expect(screen.getByText("Passwords do not match.")).toBeVisible();
    expect(signup).not.toHaveBeenCalled();
  });

  it("submits once and shows the check-email state", async () => {
    const signup = vi.fn().mockResolvedValue({ message: "Check your email." });
    render(
      <MemoryRouter>
        <SignupPage onSignup={signup} onResend={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Amara Ellis" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "amara@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.change(screen.getByLabelText("Workspace name"), {
      target: { value: "Amara's search" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeVisible();
    expect(screen.getByText("amara@example.com")).toBeVisible();
    expect(signup).toHaveBeenCalledOnce();
  });
});
