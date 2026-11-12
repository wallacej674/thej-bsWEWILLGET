import { describe, expect, it } from "vitest";

import type { MyWeek, TeamAccountabilityRow } from "../applications/types";
import {
  type DashboardData,
  appliedAgo,
  dayOfWeek,
  deriveDashboard,
  lastAppliedLabel,
  paceOf,
  teamForRings,
  timeAgo,
  weekSentence,
} from "./dashboardModel";

// Wednesday 11 November 2026, 6pm local time.
const WEDNESDAY = new Date(2026, 10, 11, 18, 0, 0);

function myWeek(overrides: Partial<MyWeek> = {}): MyWeek {
  return {
    weekly_goal: 4,
    applied_this_week: 3,
    streak_weeks: 2,
    day_streak: 3,
    recent_weeks: [],
    oldest_open: null,
    total_active: 5,
    recently_updated: 1,
    total_applied_all_time: 12,
    ...overrides,
  };
}

function row(id: string, thisWeek: number, overrides: Partial<TeamAccountabilityRow> = {}) {
  return {
    owner: { id, display_name: id, avatar_url: null },
    active: 1,
    this_week: thisWeek,
    rejected: 0,
    last_applied: null,
    weekly_goal: null,
    ...overrides,
  } satisfies TeamAccountabilityRow;
}

describe("paceOf", () => {
  it("has no pace without a goal", () => {
    expect(paceOf(3, null, 3)).toBe("none");
  });

  it("marks a met goal as hit", () => {
    expect(paceOf(5, 5, 1)).toBe("hit");
  });

  it("compares against the goal spread over the days so far", () => {
    // Goal 5 by Wednesday (day 3 of 7) expects floor(15 / 7) = 2.
    expect(paceOf(2, 5, 3)).toBe("on");
    expect(paceOf(1, 5, 3)).toBe("behind");
  });
});

describe("weekSentence", () => {
  it("prompts for a goal when none is set", () => {
    expect(weekSentence(myWeek({ weekly_goal: null }))).toBe(
      "Set a weekly goal to start building a streak.",
    );
  });

  it("counts down to the goal and mentions the streak", () => {
    expect(weekSentence(myWeek())).toBe(
      "1 more by Sunday keeps your 2-week streak alive.",
    );
    expect(weekSentence(myWeek({ streak_weeks: 0 }))).toBe(
      "1 more by Sunday starts a streak.",
    );
  });

  it("celebrates a met goal", () => {
    expect(weekSentence(myWeek({ applied_this_week: 4 }))).toBe(
      "Goal hit. Anything more is a bonus.",
    );
  });
});

describe("dates", () => {
  it("numbers the week from Monday", () => {
    expect(dayOfWeek(new Date(2026, 10, 9))).toBe(1);
    expect(dayOfWeek(WEDNESDAY)).toBe(3);
    expect(dayOfWeek(new Date(2026, 10, 15))).toBe(7);
  });

  it("describes when someone last applied", () => {
    expect(lastAppliedLabel(null, WEDNESDAY)).toBe("No applications yet");
    expect(lastAppliedLabel("2026-11-11", WEDNESDAY)).toBe("Applied today");
    expect(lastAppliedLabel("2026-11-10", WEDNESDAY)).toBe("Applied yesterday");
    expect(lastAppliedLabel("2026-11-02", WEDNESDAY)).toBe("Last applied 9 days ago");
  });

  it("says when an open application was sent", () => {
    expect(appliedAgo("2026-11-11", WEDNESDAY)).toBe("applied today");
    expect(appliedAgo("2026-11-10", WEDNESDAY)).toBe("applied yesterday");
    expect(appliedAgo("2026-10-20", WEDNESDAY)).toBe("applied 22 days ago");
  });

  it("formats elapsed time compactly", () => {
    const now = WEDNESDAY.getTime();
    expect(timeAgo(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5m ago");
    expect(timeAgo(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("3h ago");
    expect(timeAgo(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe("2d ago");
  });
});

describe("teamForRings", () => {
  it("shows the busiest members first", () => {
    const team = [row("a", 1), row("b", 4), row("c", 2)];
    const { shown, hidden } = teamForRings(team, "a", 2);
    expect(shown.map((member) => member.owner.id)).toEqual(["b", "a"]);
    expect(hidden).toBe(1);
  });

  it("always includes the signed-in member", () => {
    const team = [row("a", 5), row("b", 4), row("me", 0)];
    const { shown } = teamForRings(team, "me", 2);
    expect(shown.map((member) => member.owner.id)).toEqual(["a", "me"]);
  });
});

describe("deriveDashboard", () => {
  it("reads this week and the change from the weekly series", () => {
    const data: DashboardData = {
      summary: {
        total_active: 0,
        current_week: 0,
        recently_updated: 0,
        deleted: 0,
        status_counts: { applied: 0, rejected: 0, withdrawn: 0, closed: 0 },
        work_arrangement_counts: { remote: 0, hybrid: 0, onsite: 0, unknown: 0 },
        applications_over_time: [
          { week_start: "2026-11-02", total: 7 },
          { week_start: "2026-11-09", total: 9 },
        ],
        top_applicants: [],
        recent_activity: [],
      },
      myWeek: myWeek({
        recent_weeks: [
          { week_start: "2026-11-02", total: 2, met_goal: false },
          { week_start: "2026-11-09", total: 3, met_goal: false },
        ],
      }),
      team: [],
    };

    const view = deriveDashboard(data, WEDNESDAY);

    expect(view.teamThisWeek).toBe(9);
    expect(view.teamDelta).toBe(2);
    expect(view.weekStart).toBe("2026-11-09");
    expect(view.dayIndex).toBe(3);
    expect(view.daysLeft).toBe(4);
    expect(view.mine).toEqual([2, 3]);
  });
});
