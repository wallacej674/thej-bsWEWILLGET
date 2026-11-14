import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { MessageResponse, SignupInput } from "./authApi";
import { SignupPage } from "./SignupPage";

const PASSWORD = "correct horse battery staple";

function renderSignup({
  signup = vi.fn<(input: SignupInput) => Promise<MessageResponse>>().mockResolvedValue({
    message: "Check your email.",
  }),
  resend = vi.fn<(email: string) => Promise<MessageResponse>>().mockResolvedValue({ message: "Sent." }),
} = {}) {
  render(
    <MemoryRouter>
      <SignupPage onSignup={signup} onResend={resend} />
    </MemoryRouter>,
  );
  return { signup, resend };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function fillYou(name = "Amara Ellis", email = "amara@example.com") {
  type("Your name", name);
  type("Email address", email);
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  // The next step mounts once the current one has slid away.
  await screen.findByLabelText("Password");
}

async function fillPassword(password = PASSWORD, confirm = PASSWORD) {
  type("Password", password);
  type("Confirm password", confirm);
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  await screen.findByLabelText("Workspace name");
}

describe("SignupPage", () => {
  it("starts on the first of three steps", () => {
    renderSignup();

    expect(screen.getByRole("heading", { name: "Let's start with you" })).toBeInTheDocument();
    const progress = screen.getByRole("list", { name: "Sign-up progress" });
    expect(progress).toHaveTextContent(/You.*current step/);
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("checks a step before moving on", () => {
    const { signup } = renderSignup();

    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

    expect(screen.getByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Your name")).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Let's start with you" })).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();
  });

  it("validates the password step and ticks its checks as you type", async () => {
    renderSignup();
    await fillYou();

    type("Password", "short");
    type("Confirm password", "different");
    expect(screen.getByText("12 characters or more").parentElement).toHaveTextContent("(not yet)");
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

    expect(await screen.findByText("Use at least 12 characters.")).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();

    type("Password", PASSWORD);
    type("Confirm password", PASSWORD);
    expect(screen.getByText("12 characters or more").parentElement).toHaveTextContent("(done)");
    expect(screen.getByText("Both passwords match").parentElement).toHaveTextContent("(done)");
  });

  it("keeps what you typed when going back", async () => {
    renderSignup();
    await fillYou("Amara Ellis");

    fireEvent.click(screen.getByRole("button", { name: /Back/ }));

    expect(await screen.findByLabelText("Your name")).toHaveValue("Amara Ellis");
  });

  it("previews the workspace, submits once and shows the check-email state", async () => {
    const { signup } = renderSignup();
    await fillYou();
    await fillPassword();
    expect(screen.getByRole("heading", { name: "Name your crew's space" })).toBeInTheDocument();

    type("Workspace name", "Amara's search");
    expect(screen.getAllByText("Amara's search").length).toBeGreaterThan(0);
    const create = screen.getByRole("button", { name: "Create account" });
    fireEvent.click(create);
    fireEvent.click(create);

    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(await screen.findByText("amara@example.com")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Send again in 60s" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Return to sign in" })).toHaveAttribute("href", "/login");
    expect(signup).toHaveBeenCalledOnce();
    expect(signup).toHaveBeenCalledWith({
      displayName: "Amara Ellis",
      email: "amara@example.com",
      password: PASSWORD,
      workspaceName: "Amara's search",
    });
  });

  it("explains when the account was saved but the email didn't send", async () => {
    renderSignup({ signup: vi.fn().mockRejectedValue({ code: "email_delivery_unavailable" }) });
    await fillYou();
    await fillPassword();
    type("Workspace name", "Amara's search");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Your account is saved" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Send a new link" })).toBeEnabled();
  });

  it("returns to the first step with a message when the account can't be created", async () => {
    renderSignup({ signup: vi.fn().mockRejectedValue(new Error("conflict")) });
    await fillYou();
    await fillPassword();
    type("Workspace name", "Amara's search");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("The account could not be created. Check the form and try again."),
    ).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Let's start with you" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Email address")).toHaveFocus();
  });
});
