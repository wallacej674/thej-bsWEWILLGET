import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applicationsApi } from "../features/applications/api";
import type {
  TeamAccountabilityResponse,
  TeamAccountabilityRow,
} from "../features/applications/types";
import { TeamAccountabilityCard } from "./App";

type Context = ComponentProps<typeof TeamAccountabilityCard>["context"];

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

function row(id: string, displayName: string): TeamAccountabilityRow {
  return {
    owner: { id, display_name: displayName, avatar_url: null },
    active: 1,
    this_week: 1,
    rejected: 0,
    last_applied: null,
    weekly_goal: null,
  };
}

function response(item: TeamAccountabilityRow): TeamAccountabilityResponse {
  return {
    items: [item],
    pagination: {
      page: 1,
      page_size: 10,
      total_items: 1,
      total_pages: 1,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("TeamAccountabilityCard", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the newest search result when an older request finishes last", async () => {
    vi.useFakeTimers();
    const older = deferred<TeamAccountabilityResponse>();
    const newer = deferred<TeamAccountabilityResponse>();
    const request = vi
      .spyOn(applicationsApi, "teamAccountability")
      .mockResolvedValueOnce(response(row("initial", "Initial Member")))
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    render(<TeamAccountabilityCard context={context} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("Initial Member")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Search members"), {
      target: { value: "a" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.change(screen.getByLabelText("Search members"), {
      target: { value: "ab" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(request).toHaveBeenCalledTimes(3);

    await act(async () => {
      newer.resolve(response(row("newer", "Abby Newer")));
      await newer.promise;
    });
    expect(screen.getByText("Abby Newer")).toBeVisible();

    await act(async () => {
      older.resolve(response(row("older", "Alice Older")));
      await older.promise;
    });

    expect(screen.getByText("Abby Newer")).toBeVisible();
    expect(screen.queryByText("Alice Older")).not.toBeInTheDocument();
  });
});
