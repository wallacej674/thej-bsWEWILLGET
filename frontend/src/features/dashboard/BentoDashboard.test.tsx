import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { CurrentUser, MyWeek, TeamAccountabilityRow } from "../applications/types";
import { BentoDashboard } from "./BentoDashboard";
import type { DashboardData } from "./dashboardModel";

const user: CurrentUser = { id: "user-1", display_name: "Jonathan Wallace", avatar_url: null };

function member(id: string, name: string, overrides: Partial<TeamAccountabilityRow> = {}) {
  return {
    owner: { id, display_name: name, avatar_url: null },
    active: 2,
    this_week: 1,
    rejected: 0,
    last_applied: null,
    weekly_goal: null,
    ...overrides,
  } satisfies TeamAccountabilityRow;
}

function buildData({
  myWeek = {},
  team = [member("user-1", "Jonathan Wallace"), member("user-2", "Kareem Ali")],
}: { myWeek?: Partial<MyWeek>; team?: TeamAccountabilityRow[] } = {}): DashboardData {
  return {
    summary: {
      total_active: 2,
      current_week: 2,
      recently_updated: 0,
      deleted: 0,
      status_counts: { applied: 2, rejected: 0, withdrawn: 0, closed: 0 },
      work_arrangement_counts: { remote: 2, hybrid: 0, onsite: 0, unknown: 0 },
      applications_over_time: [
        { week_start: "2026-11-02", total: 0 },
        { week_start: "2026-11-09", total: 2 },
      ],
      top_applicants: [],
      recent_activity: [
        {
          application_id: "app-1",
          company_name: "Fictional Systems",
          job_title: "Sample Role",
          owner: { id: "user-2", display_name: "Kareem Ali", avatar_url: null },
          action: "added",
          occurred_at: new Date().toISOString(),
          status: "applied",
        },
      ],
    },
    myWeek: {
      weekly_goal: null,
      applied_this_week: 1,
      streak_weeks: 0,
      day_streak: 1,
      recent_weeks: [
        { week_start: "2026-11-02", total: 0, met_goal: false },
        { week_start: "2026-11-09", total: 1, met_goal: false },
      ],
      oldest_open: {
        application_id: "app-9",
        company_name: "Copperline Studio",
        job_title: "UX Researcher",
        application_date: "2026-10-20",
      },
      total_active: 1,
      recently_updated: 0,
      total_applied_all_time: 7,
      ...myWeek,
    },
    team,
  };
}

function renderDashboard(data: DashboardData, onSetGoal = vi.fn(() => Promise.resolve())) {
  render(
    <MemoryRouter>
      <BentoDashboard
        data={data}
        user={user}
        onSetGoal={onSetGoal}
        teamDetails={<p>Team table</p>}
      />
    </MemoryRouter>,
  );
  return onSetGoal;
}

describe("BentoDashboard", () => {
  it("greets the member and lays out the week, team and activity", () => {
    renderDashboard(buildData());

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Jonathan");
    expect(
      screen.getByText("Set a weekly goal to start building a streak."),
    ).toBeInTheDocument();
    expect(screen.getByText("7 sent all-time")).toBeInTheDocument();
    // Once on the team ring and once in the recent-activity tile.
    expect(screen.getAllByText("Kareem Ali")).toHaveLength(2);
    expect(screen.getAllByText("1/– this week")).toHaveLength(2);
    expect(screen.getByText("Fictional Systems", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Copperline Studio/ })).toHaveAttribute(
      "href",
      "/applications/app-9",
    );
    expect(screen.getByText("Team table")).toBeInTheDocument();
  });

  it("saves a new weekly goal", async () => {
    const onSetGoal = renderDashboard(buildData());

    fireEvent.click(screen.getByRole("button", { name: "Set a weekly goal" }));
    fireEvent.change(screen.getByLabelText("Applications per week"), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save goal" }));

    expect(onSetGoal).toHaveBeenCalledWith(6);
    expect(
      await screen.findByRole("button", { name: "Set a weekly goal" }),
    ).toBeInTheDocument();
  });

  it("keeps the editor open with a message when the goal cannot be saved", async () => {
    renderDashboard(
      buildData(),
      vi.fn(() => Promise.reject(new Error("offline"))),
    );

    fireEvent.click(screen.getByRole("button", { name: "Set a weekly goal" }));
    fireEvent.click(screen.getByRole("button", { name: "Save goal" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The goal could not be saved. Try again.",
    );
    expect(screen.getByLabelText("Applications per week")).toBeInTheDocument();
  });

  it("links to the full team when there are more members than rings", () => {
    const team = Array.from({ length: 10 }, (_, index) =>
      member(`member-${index}`, `Member ${index}`, { this_week: 10 - index }),
    );
    renderDashboard(buildData({ team: [...team, member("user-1", "Jonathan Wallace")] }));

    expect(screen.getByRole("link", { name: "+3 more" })).toHaveAttribute(
      "href",
      "#team-details",
    );
    expect(screen.getByText("Jonathan", { exact: false, selector: "p" })).toBeInTheDocument();
  });
});
