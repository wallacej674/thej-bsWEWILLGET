import type {
  ApplicationStatus,
  ApplicationSummary,
  MyWeek,
  TeamAccountabilityRow,
  WorkArrangement,
} from "../applications/types";

export interface DashboardData {
  summary: ApplicationSummary;
  myWeek: MyWeek;
  /** Team rows sorted by this week's count, highest first. */
  team: TeamAccountabilityRow[];
}

const DAY_MS = 86_400_000;

// --- Dates -----------------------------------------------------------------

/** Parses an ISO date ("2026-11-09") at local noon, or a full timestamp. */
export function parseDay(value: string): Date {
  return new Date(value.length === 10 ? `${value}T12:00:00` : value);
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

export function isoDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Day of the application week: Monday = 1 … Sunday = 7. */
export function dayOfWeek(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1;
}

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function shortDate(value: string): string {
  return monthDay.format(parseDay(value));
}

export function weekRange(weekStart: string): string {
  const start = parseDay(weekStart);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${monthDay.format(start)} – ${monthDay.format(end)}`;
}

export function daysSince(value: string, now: Date = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(parseDay(value))) / DAY_MS);
}

export function lastAppliedLabel(value: string | null, now: Date = new Date()): string {
  if (!value) return "No applications yet";
  const days = daysSince(value, now);
  if (days <= 0) return "Applied today";
  if (days === 1) return "Applied yesterday";
  return `Last applied ${days} days ago`;
}

export function appliedAgo(value: string, now: Date = new Date()): string {
  const days = daysSince(value, now);
  if (days <= 0) return "applied today";
  if (days === 1) return "applied yesterday";
  return `applied ${days} days ago`;
}

/** A member who has not applied for five or more days. */
export function isQuiet(value: string | null, now: Date = new Date()): boolean {
  return value === null || daysSince(value, now) >= 5;
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// --- Pace ------------------------------------------------------------------

export type Pace = "hit" | "on" | "behind" | "none";

export const PACE_META: Record<Pace, { label: string; text: string; color: string }> = {
  hit: { label: "Goal hit", text: "text-[#c3c88a]", color: "#9aa05f" },
  on: { label: "On pace", text: "text-[#e0b850]", color: "#d6a844" },
  behind: { label: "Behind", text: "text-[#e09a9b]", color: "#c2686a" },
  none: { label: "No goal", text: "text-muted-foreground", color: "#8c8170" },
};

/**
 * Whether a member is keeping up with their weekly goal: on pace means at
 * least the goal spread evenly over the days of the week so far.
 */
export function paceOf(done: number, goal: number | null, dayIndex: number): Pace {
  if (!goal) return "none";
  if (done >= goal) return "hit";
  return done >= Math.floor((goal * dayIndex) / 7) ? "on" : "behind";
}

export function weekSentence(me: MyWeek): string {
  const done = me.applied_this_week;
  const goal = me.weekly_goal;
  if (!goal) return "Set a weekly goal to start building a streak.";
  if (done >= goal) return "Goal hit. Anything more is a bonus.";
  return `${goal - done} more by Sunday ${
    me.streak_weeks > 0 ? `keeps your ${me.streak_weeks}-week streak alive` : "starts a streak"
  }.`;
}

// --- Breakdown palettes ----------------------------------------------------

export const STATUS_META: Record<ApplicationStatus, { label: string; color: string }> = {
  applied: { label: "Applied", color: "#d6a844" },
  rejected: { label: "Rejected", color: "#c2686a" },
  withdrawn: { label: "Withdrawn", color: "#8c8170" },
  closed: { label: "Closed", color: "#b08953" },
};

export const ARRANGEMENT_META: Record<WorkArrangement, { label: string; color: string }> = {
  remote: { label: "Remote", color: "#5f8f8a" },
  hybrid: { label: "Hybrid", color: "#cc7a4d" },
  onsite: { label: "Onsite", color: "#9aa05f" },
  unknown: { label: "Unknown", color: "#6b6253" },
};

// --- Derived view model ----------------------------------------------------

export function sortTeam(team: TeamAccountabilityRow[]): TeamAccountabilityRow[] {
  return [...team].sort(
    (a, b) =>
      b.this_week - a.this_week ||
      b.active - a.active ||
      a.owner.display_name.localeCompare(b.owner.display_name),
  );
}

/**
 * The members shown as rings: the busiest `limit`, always including the
 * signed-in member so people can find themselves.
 */
export function teamForRings(
  team: TeamAccountabilityRow[],
  userId: string,
  limit: number,
): { shown: TeamAccountabilityRow[]; hidden: number } {
  const sorted = sortTeam(team);
  let shown = sorted.slice(0, limit);
  const me = sorted.find((row) => row.owner.id === userId);
  if (me && !shown.includes(me)) shown = [...shown.slice(0, limit - 1), me];
  return { shown, hidden: Math.max(0, sorted.length - shown.length) };
}

export function deriveDashboard(data: DashboardData, now: Date = new Date()) {
  const weeks = data.summary.applications_over_time;
  const count = weeks.length;
  const teamThisWeek = count ? weeks[count - 1].total : data.summary.current_week;
  const teamLastWeek = count > 1 ? weeks[count - 2].total : 0;
  const dayIndex = dayOfWeek(now);
  return {
    weeks,
    teamThisWeek,
    teamDelta: teamThisWeek - teamLastWeek,
    weekStart: count ? weeks[count - 1].week_start : isoDay(mondayOf(now)),
    dayIndex,
    daysLeft: 7 - dayIndex,
    mine: data.myWeek.recent_weeks.map((week) => week.total),
  };
}
