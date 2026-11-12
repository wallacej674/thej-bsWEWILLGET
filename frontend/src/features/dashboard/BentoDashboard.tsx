import { type ReactNode, useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { Check, ChevronRight, Flame, Plus, Target } from "lucide-react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";

import type {
  ApplicationSummary,
  CurrentUser,
  TeamAccountabilityRow,
} from "../applications/types";
import { avatarColor, initials } from "../members/avatar";
import {
  ArrangementDonut,
  GoalRing,
  Sparkline,
  StatusStrip,
  WeekBars,
} from "./DashboardCharts";
import {
  type DashboardData,
  PACE_META,
  appliedAgo,
  deriveDashboard,
  greeting,
  isQuiet,
  lastAppliedLabel,
  paceOf,
  teamForRings,
  timeAgo,
  weekRange,
  weekSentence,
} from "./dashboardModel";
import { EASE_OUT, EYEBROW, PANEL, PRIMARY_BUTTON } from "./dashboardStyles";
import { CountUp, SpotlightTile } from "./motion";

const MAX_RINGS = 8;
const ACTIVITY_ROTATE_MS = 4000;

function MemberAvatar({ id, name, size }: { id: string; name: string; size: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex flex-none items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: avatarColor(id),
      }}
    >
      {initials(name)}
    </span>
  );
}

function Delta({ value }: { value: number }) {
  if (value > 0) return <span className="text-success">▲ {value}</span>;
  if (value < 0) return <span className="text-destructive">▼ {Math.abs(value)}</span>;
  return <span className="text-muted-foreground">— no change</span>;
}

function GoalEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: number | null;
  onSave(goal: number): Promise<void>;
  onClose(): void;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState(String(initial ?? 5));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const save = async () => {
    const parsed = Math.round(Number(draft));
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
      setError("Choose a number from 1 to 100.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await onSave(parsed);
      onClose();
    } catch {
      setError("The goal could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="text-xs text-muted-foreground">
          Applications per week
        </label>
        <input
          id={inputId}
          type="number"
          min={1}
          max={100}
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
            if (event.key === "Escape") onClose();
          }}
          className="font-numeric h-9 w-20 rounded-lg border border-border bg-input px-2 text-center text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={PRIMARY_BUTTON}
        >
          {saving ? "Saving…" : "Save goal"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function activityText(activity: ApplicationSummary["recent_activity"][number]) {
  return (
    <>
      <span className="font-semibold text-foreground">{activity.owner.display_name}</span>{" "}
      <span className="text-muted-foreground">{activity.action}</span>{" "}
      <span className="text-foreground">{activity.job_title}</span>
      <span className="text-muted-foreground"> · {activity.company_name}</span>
    </>
  );
}

/** Shows one recent activity at a time, moving on every few seconds. */
function ActivityRotator({ activities }: { activities: ApplicationSummary["recent_activity"] }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (activities.length < 2 || hovered || reduce) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % activities.length),
      ACTIVITY_ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [activities.length, hovered, reduce]);

  if (activities.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        Activity shows up here as the team adds and updates applications.
      </p>
    );
  }

  const current = index % activities.length;
  const item = activities[current];
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div className="relative mt-4 min-h-[64px] overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${item.application_id}-${item.occurred_at}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
          >
            <Link
              to={`/applications/${item.application_id}`}
              className="flex items-start gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <MemberAvatar id={item.owner.id} name={item.owner.display_name} size={36} />
              <span className="min-w-0">
                <span className="block text-[15px] leading-6">{activityText(item)}</span>
                <span className="font-numeric mt-0.5 block text-[11px] text-muted-foreground">
                  {timeAgo(item.occurred_at)}
                </span>
              </span>
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>
      {activities.length > 1 ? (
        <div className="mt-3 flex gap-1.5">
          {activities.map((activity, dot) => (
            <button
              key={`${activity.application_id}-${activity.occurred_at}`}
              type="button"
              aria-label={`Show activity ${dot + 1} of ${activities.length}`}
              aria-current={dot === current}
              onClick={() => setIndex(dot)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                dot === current ? "w-6 bg-primary" : "w-1.5 bg-foreground/15 hover:bg-foreground/30"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A member's avatar inside a ring that fills toward their weekly goal. */
function MemberRing({
  row,
  isMe,
  dayIndex,
  delay,
  detailed,
}: {
  row: TeamAccountabilityRow;
  isMe: boolean;
  dayIndex: number;
  delay: number;
  detailed: boolean;
}) {
  const pace = paceOf(row.this_week, row.weekly_goal, dayIndex);
  const size = detailed ? 76 : 64;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = row.weekly_goal
    ? Math.min(1, row.this_week / row.weekly_goal)
    : row.this_week
      ? 1
      : 0;
  const quiet = isQuiet(row.last_applied);

  return (
    <motion.li
      className="flex min-w-0 flex-col items-center text-center"
      initial={{ opacity: 0, scale: 0.85 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ type: "spring", stiffness: 220, damping: 18, delay }}
    >
      <div
        className={`relative rounded-full ${pace === "hit" ? "dashboard-glow" : ""}`}
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0 -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            style={{ stroke: "var(--track)" }}
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={PACE_META[pace].color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            whileInView={{ strokeDashoffset: circumference * (1 - progress) }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: EASE_OUT, delay: delay + 0.2 }}
          />
        </svg>
        <span className="absolute inset-[7px] flex">
          <MemberAvatar id={row.owner.id} name={row.owner.display_name} size={size - 14} />
        </span>
      </div>
      <p className="mt-2 max-w-full truncate text-xs font-medium text-foreground">
        {detailed ? row.owner.display_name : row.owner.display_name.split(" ")[0]}
        {isMe ? <span className="text-primary"> · you</span> : null}
      </p>
      <p className="font-numeric text-[11px] text-muted-foreground">
        {row.this_week}/{row.weekly_goal ?? "–"} this week
      </p>
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${PACE_META[pace].text}`}>
        {PACE_META[pace].label}
      </p>
      {detailed ? (
        <p className={`mt-1 text-[11px] ${quiet ? "text-destructive" : "text-muted-foreground"}`}>
          {lastAppliedLabel(row.last_applied)} · {row.active} active
        </p>
      ) : null}
    </motion.li>
  );
}

export function BentoDashboard({
  data,
  user,
  onSetGoal,
  teamDetails,
}: {
  data: DashboardData;
  user: CurrentUser;
  onSetGoal(goal: number): Promise<void>;
  /** Full team table, rendered under the tiles. */
  teamDetails?: ReactNode;
}) {
  const view = deriveDashboard(data);
  const me = data.myWeek;
  const [editingGoal, setEditingGoal] = useState(false);
  const rings = teamForRings(data.team, user.id, MAX_RINGS);
  const detailedRings = rings.shown.length <= 4;
  const firstName = user.display_name.split(" ")[0];

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="mb-6 flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <p className={EYEBROW}>Overview · {weekRange(view.weekStart)}</p>
            <h1 className="font-display mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
              {greeting()}, {firstName}
            </h1>
          </div>
          <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            Day {view.dayIndex} of 7 ·{" "}
            {view.daysLeft === 0 ? "last day" : `${view.daysLeft} days left`}
          </span>
        </motion.header>

        <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 lg:auto-rows-[minmax(170px,auto)] lg:grid-cols-4">
          <SpotlightTile delay={0} className="p-6 sm:col-span-2 lg:row-span-2">
            <section
              aria-label="Your week"
              className="flex h-full flex-col justify-center gap-6 sm:flex-row sm:items-center"
            >
              <GoalRing done={me.applied_this_week} goal={me.weekly_goal} />
              <div className="min-w-0 flex-1">
                <h2 className={EYEBROW}>Your week</h2>
                <p className="font-display mt-2 text-xl font-semibold leading-snug text-foreground">
                  {weekSentence(me)}
                </p>
                <ul className="mt-4 flex flex-wrap gap-2 text-xs">
                  <li className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-foreground">
                    <Flame
                      size={13}
                      aria-hidden="true"
                      className={
                        me.streak_weeks ? "dashboard-flicker text-primary" : "text-muted-foreground"
                      }
                    />
                    {me.streak_weeks}-week streak
                  </li>
                  <li className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-subtle">
                    {me.day_streak}-day activity streak
                  </li>
                  <li className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-subtle">
                    {me.total_applied_all_time} sent all-time
                  </li>
                </ul>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {editingGoal ? (
                    <GoalEditor
                      initial={me.weekly_goal}
                      onSave={onSetGoal}
                      onClose={() => setEditingGoal(false)}
                    />
                  ) : (
                    <>
                      <Link to="/applications/new" className={PRIMARY_BUTTON}>
                        <Plus size={15} aria-hidden="true" /> Log
                        application
                      </Link>
                      <button
                        type="button"
                        onClick={() => setEditingGoal(true)}
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
                      >
                        <Target size={13} aria-hidden="true" />
                        {me.weekly_goal ? "Edit weekly goal" : "Set a weekly goal"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>
          </SpotlightTile>

          <SpotlightTile delay={0.06} className="p-5">
            <h2 className={EYEBROW}>Team sent this week</h2>
            <p className="font-numeric mt-3 text-[2.6rem] leading-none text-foreground">
              <CountUp value={view.teamThisWeek} />
            </p>
            <p className="mt-1.5 text-[11px]">
              <Delta value={view.teamDelta} />{" "}
              <span className="text-muted-foreground">vs last week</span>
            </p>
            <Sparkline
              points={view.weeks.map((week) => week.total)}
              label={`Team applications over the last ${view.weeks.length} weeks`}
            />
          </SpotlightTile>

          <SpotlightTile delay={0.12} className="p-5">
            <h2 className={EYEBROW}>Active pipeline</h2>
            <p className="font-numeric mt-3 text-[2.6rem] leading-none text-foreground">
              <CountUp value={data.summary.total_active} />
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {me.total_active} yours · {data.summary.recently_updated} updated recently
            </p>
            <StatusStrip counts={data.summary.status_counts} />
          </SpotlightTile>

          <SpotlightTile delay={0.18} className="p-5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className={EYEBROW}>Recent activity</h2>
              <Link
                to="/applications"
                className="text-[11px] text-muted-foreground transition-colors hover:text-primary"
              >
                View all
              </Link>
            </div>
            <ActivityRotator activities={data.summary.recent_activity} />
          </SpotlightTile>

          <SpotlightTile delay={0.24} className="p-5 sm:col-span-2 lg:row-span-2">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between">
                <h2 className={EYEBROW}>Team this week</h2>
                {rings.hidden > 0 ? (
                  <a
                    href="#team-details"
                    className="text-[11px] text-muted-foreground transition-colors hover:text-primary"
                  >
                    +{rings.hidden} more
                  </a>
                ) : null}
              </div>
              {rings.shown.length === 0 ? (
                <p className="mt-6 text-sm text-muted-foreground">No members yet.</p>
              ) : (
                <ul
                  className={`grid gap-x-3 gap-y-6 py-6 ${
                    detailedRings
                      ? "my-auto grid-cols-2"
                      : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4"
                  }`}
                >
                  {rings.shown.map((row, index) => (
                    <MemberRing
                      key={row.owner.id}
                      row={row}
                      isMe={row.owner.id === user.id}
                      dayIndex={view.dayIndex}
                      delay={0.2 + index * 0.08}
                      detailed={detailedRings}
                    />
                  ))}
                </ul>
              )}
            </div>
          </SpotlightTile>

          <SpotlightTile delay={0.3} className="p-5 sm:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className={EYEBROW}>Last {view.weeks.length} weeks</h2>
              <span aria-hidden="true" className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-primary" /> You
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-primary/30" /> Team
                </span>
              </span>
            </div>
            <WeekBars weeks={view.weeks} mine={view.mine} />
          </SpotlightTile>

          <SpotlightTile delay={0.36} className="p-5">
            {me.oldest_open ? (
              <Link
                to={`/applications/${me.oldest_open.application_id}`}
                className="group/follow flex h-full flex-col rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <h2 className={EYEBROW}>Waiting on you</h2>
                <p className="font-display mt-3 text-lg font-semibold leading-snug text-foreground">
                  {me.oldest_open.company_name}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {me.oldest_open.job_title} · {appliedAgo(me.oldest_open.application_date)}
                </p>
                <span className="mt-auto flex items-center gap-1 pt-4 text-xs font-semibold text-primary">
                  Follow up
                  <ChevronRight
                    size={14}
                    aria-hidden="true"
                    className="transition-transform group-hover/follow:translate-x-1"
                  />
                </span>
              </Link>
            ) : (
              <div className="flex h-full flex-col items-start">
                <h2 className={EYEBROW}>Waiting on you</h2>
                <span className="mt-4 flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check size={18} aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm text-foreground">All caught up</p>
              </div>
            )}
          </SpotlightTile>

          <SpotlightTile delay={0.42} className="p-5">
            <h2 className={`${EYEBROW} mb-4`}>Work arrangement</h2>
            <ArrangementDonut counts={data.summary.work_arrangement_counts} />
          </SpotlightTile>
        </div>

        {teamDetails ? (
          <motion.section
            id="team-details"
            aria-label="Team details"
            className="mt-8 scroll-mt-24"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          >
            {teamDetails}
          </motion.section>
        ) : null}
      </div>
    </MotionConfig>
  );
}

/** Placeholder with the same tile layout, shown while the data loads. */
export function BentoDashboardSkeleton() {
  const tiles = [
    "sm:col-span-2 lg:row-span-2",
    "",
    "",
    "sm:col-span-2",
    "sm:col-span-2 lg:row-span-2",
    "sm:col-span-2",
    "",
    "",
  ];
  return (
    <div
      className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <div className="mb-6 space-y-2">
        <div className="h-3 w-40 animate-pulse rounded bg-foreground/[0.06]" />
        <div className="h-7 w-64 animate-pulse rounded bg-foreground/[0.08]" />
      </div>
      <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 lg:auto-rows-[minmax(170px,auto)] lg:grid-cols-4">
        {tiles.map((span, index) => (
          <div key={index} className={`${PANEL} min-h-[170px] animate-pulse ${span}`} />
        ))}
      </div>
    </div>
  );
}
