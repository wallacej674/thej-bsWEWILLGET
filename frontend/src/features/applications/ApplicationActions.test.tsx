import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApplicationActions } from "./ApplicationActions";

describe("application actions", () => {
  it("shows mutation controls only to the application owner", () => {
    const { rerender } = render(
      <ApplicationActions
        applicationOwnerId="jonathan-id"
        currentUserId="kareem-id"
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "View application" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Edit application" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete application" })).toBeNull();

    rerender(
      <ApplicationActions
        applicationOwnerId="jonathan-id"
        currentUserId="jonathan-id"
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Edit application" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete application" })).toBeVisible();
  });
});
