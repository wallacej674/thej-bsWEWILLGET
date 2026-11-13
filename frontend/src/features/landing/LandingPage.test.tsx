import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LandingPage } from "./LandingPage";

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

// jsdom has no scrollIntoView; the nav test stands one in.
const originalScrollIntoView = Element.prototype.scrollIntoView;
afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

describe("LandingPage", () => {
  it("leads with the mission as one readable headline", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Stay accountable, present and active, together.",
      }),
    ).toBeInTheDocument();
  });

  it("sends every sign-up call to action to /signup and sign-in to /login", () => {
    renderLanding();

    for (const name of ["Get started", "Join the circle", "Start your circle"]) {
      expect(screen.getByRole("link", { name: new RegExp(name) })).toHaveAttribute("href", "/signup");
    }
    const signIns = screen.getAllByRole("link", { name: "Sign in" });
    expect(signIns.length).toBeGreaterThan(1);
    for (const link of signIns) expect(link).toHaveAttribute("href", "/login");
  });

  it("walks through the three promises", () => {
    renderLanding();

    for (const word of ["Accountable", "Present", "Active"]) {
      expect(screen.getByRole("heading", { level: 3, name: word })).toBeInTheDocument();
    }
  });

  it("scrolls to the mission and features sections from the nav", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderLanding();
    const nav = screen.getByRole("navigation");

    fireEvent.click(within(nav).getByRole("link", { name: "Mission" }));
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("mission"));

    fireEvent.click(within(nav).getByRole("link", { name: "Features" }));
    expect(scrollIntoView.mock.contexts[1]).toBe(document.getElementById("features"));
  });

  it("lets a visitor set a weekly pledge", () => {
    renderLanding();
    const slider = screen.getByRole("slider", { name: "My weekly goal" });
    expect(slider).toHaveValue("5");

    fireEvent.change(slider, { target: { value: "10" } });

    expect(slider).toHaveValue("10");
    expect(screen.getByText("10", { selector: "output" })).toBeInTheDocument();
  });
});
