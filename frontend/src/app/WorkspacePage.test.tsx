import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { workspaceApi } from "../features/applications/api";
import { WorkspacePage } from "./App";

type Context = ComponentProps<typeof WorkspacePage>["context"];

const context = {
  client: {},
  session: {
    user: {
      id: "current-user",
      display_name: "Jonathan",
      avatar_url: null,
    },
    workspace: {
      id: "workspace-1",
      name: "ApplyTogether",
      role: "owner" as const,
    },
  },
  workspaces: [],
  switchWorkspace: vi.fn(),
  refreshWorkspaces: vi.fn().mockResolvedValue([]),
  logout: vi.fn().mockResolvedValue(undefined),
  changePassword: vi.fn().mockResolvedValue(undefined),
} as unknown as Context;

const memberResponse = {
  items: [
    {
      user: {
        id: "current-user",
        display_name: "Jonathan",
        email: "jonathan@example.test",
        avatar_url: null,
      },
      role: "owner" as const,
      joined_at: "2026-01-01T00:00:00Z",
    },
  ],
  pagination: {
    page: 1,
    page_size: 20,
    total_items: 1,
    total_pages: 1,
  },
  member_count: 1,
};

const invitationResponse = {
  items: [],
  pagination: {
    page: 1,
    page_size: 100,
    total_items: 0,
    total_pages: 0,
  },
};

describe("WorkspacePage", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("debounces member search without reloading invitations", async () => {
    vi.useFakeTimers();
    const members = vi
      .spyOn(workspaceApi, "members")
      .mockResolvedValue(memberResponse);
    const invitations = vi
      .spyOn(workspaceApi, "invitations")
      .mockResolvedValue(invitationResponse);

    render(
      <MemoryRouter>
        <WorkspacePage context={context} />
      </MemoryRouter>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(members).toHaveBeenCalledTimes(1);
    expect(invitations).toHaveBeenCalledTimes(1);

    const search = screen.getByPlaceholderText(
      "Search members by name or email",
    );
    fireEvent.change(search, { target: { value: "a" } });
    fireEvent.change(search, { target: { value: "ab" } });
    fireEvent.change(search, { target: { value: "abby" } });

    expect(members).toHaveBeenCalledTimes(1);
    expect(invitations).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(members).toHaveBeenCalledTimes(2);
    expect(members).toHaveBeenLastCalledWith(
      context.client,
      "workspace-1",
      expect.objectContaining({ search: "abby" }),
    );
    expect(invitations).toHaveBeenCalledTimes(1);
  });
});
