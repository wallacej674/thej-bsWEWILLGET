import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApplicationActions } from "./ApplicationActions";

describe("application actions", () => {
  it("shows edit to the author and delete to the author or workspace owner", () => {
    const { rerender } = render(
      <ApplicationActions
        applicationOwnerId="jonathan-id"
        currentUserId="kareem-id"
        canModerate={false}
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
        canModerate={false}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Edit application" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete application" })).toBeVisible();

    rerender(
      <ApplicationActions
        applicationOwnerId="jonathan-id"
        currentUserId="kareem-id"
        canModerate
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit application" })).toBeNull();
    expect(screen.getByRole("button", { name: "Delete application" })).toBeVisible();
  });
});
