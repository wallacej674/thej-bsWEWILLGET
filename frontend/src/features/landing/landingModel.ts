// Pure helpers behind the landing page's demos and pledge.

/** Index into a looping list, for any integer (negative ones included). */
export function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

/** Where a point `angle` degrees round a ring sits, as % of the ring's box. */
export function ringPoint(angle: number): { left: string; top: string } {
  const radians = (angle * Math.PI) / 180;
  return {
    left: `${50 + 50 * Math.cos(radians)}%`,
    top: `${50 + 50 * Math.sin(radians)}%`,
  };
}

export type Pace = "hit" | "on" | "behind";

/** A member's pace `day` days into a seven-day week (as the dashboard reads it). */
export function paceOf(done: number, goal: number, day: number): Pace {
  if (done >= goal) return "hit";
  return done >= Math.floor((goal * day) / 7) ? "on" : "behind";
}

export type MatchVerdict = "strong" | "good" | "weak";

/** The résumé tailor's verdict for a match score out of 100. */
export function matchVerdict(score: number): MatchVerdict {
  if (score >= 75) return "strong";
  if (score >= 50) return "good";
  return "weak";
}

export const PLEDGE_MIN = 1;
export const PLEDGE_MAX = 15;
export const PLEDGE_WEEKS = 12;

export interface PledgeStats {
  /** The weekly goal, clamped to the slider's range. */
  goal: number;
  /** The most a day needs, spreading the goal over five weekdays. */
  perDay: number;
  /** Applications sent if the pledge is kept for `weeks` weeks. */
  total: number;
  weeks: number;
  /** Bar height for one week of the chart, as a % of the chart. */
  barPct: number;
}

export function pledgeStats(goal: number, weeks = PLEDGE_WEEKS): PledgeStats {
  const clamped = Math.min(PLEDGE_MAX, Math.max(PLEDGE_MIN, Math.round(goal)));
  return {
    goal: clamped,
    perDay: Math.ceil(clamped / 5),
    total: clamped * weeks,
    weeks,
    barPct: (clamped / PLEDGE_MAX) * 82 + 8,
  };
}
