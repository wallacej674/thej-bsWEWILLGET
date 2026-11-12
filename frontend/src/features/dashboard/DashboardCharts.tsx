// Animated, dependency-free charts for the Bento dashboard. Each chart is
// decorative SVG with a text alternative on its container.
import { useId } from "react";
import { motion } from "motion/react";

import type { ApplicationStatus, WorkArrangement } from "../applications/types";
import {
  ARRANGEMENT_META,
  STATUS_META,
  shortDate,
  weekRange,
} from "./dashboardModel";
import { EASE_OUT } from "./dashboardStyles";
import { CountUp } from "./motion";

/** Weekly goal ring that draws in, with the count in the middle. */
export function GoalRing({
  done,
  goal,
  size = 176,
}: {
  done: number;
  goal: number | null;
  size?: number;
}) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = goal ? Math.min(1, done / goal) : 0;
  const hit = goal !== null && done >= goal;
  const gradientId = `goal-ring-${useId().replace(/:/g, "")}`;
  const label = goal
    ? `${done} of ${goal} applications this week`
    : `${done} applications this week, no goal set`;

  return (
    <div
      role="img"
      aria-label={label}
      className="relative flex-none"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="-rotate-90 drop-shadow-[0_0_18px_rgba(214,168,68,0.22)]"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f0cf7a" />
            <stop offset="100%" stopColor="#b8862e" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2e2113"
          strokeWidth={stroke}
          strokeDasharray={goal ? undefined : "3 9"}
        />
        {goal ? (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={hit ? "#9aa05f" : `url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - progress) }}
            transition={{ duration: 1.5, ease: EASE_OUT, delay: 0.25 }}
          />
        ) : null}
      </svg>
      <div
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center text-center"
      >
        <span className="font-numeric text-[2.6rem] leading-none text-foreground">
          <CountUp value={done} />
        </span>
        <span className="mt-1.5 text-[11px] text-muted-foreground">
          {goal ? `of ${goal} this week` : "sent this week"}
        </span>
      </div>
    </div>
  );
}

/** Line that draws itself across the tile. */
export function Sparkline({ points, label }: { points: number[]; label: string }) {
  if (points.length < 2) return null;
  const width = 240;
  const height = 40;
  const max = Math.max(1, ...points);
  const step = width / (points.length - 1);
  const path = points
    .map((value, index) => {
      const x = (index * step).toFixed(1);
      const y = (height - 4 - (value / max) * (height - 8)).toFixed(1);
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-3 block h-10 w-full"
    >
      <motion.path
        d={path}
        fill="none"
        stroke="#d6a844"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease: EASE_OUT, delay: 0.3 }}
      />
    </svg>
  );
}

/**
 * Team applications per week as growing columns, with the member's own
 * share highlighted inside each column.
 */
export function WeekBars({
  weeks,
  mine,
  height = 120,
}: {
  weeks: { week_start: string; total: number }[];
  mine: number[];
  height?: number;
}) {
  const max = Math.max(1, ...weeks.map((week) => week.total));
  const barArea = height - 18;
  const last = weeks.length - 1;
  const label = weeks
    .map((week, index) => `${weekRange(week.week_start)}: ${week.total} team, ${mine[index] ?? 0} yours`)
    .join("; ");

  return (
    <div role="img" aria-label={`Applications per week. ${label}`}>
      <div aria-hidden="true" className="flex items-end gap-2" style={{ height }}>
        {weeks.map((week, index) => {
          const yours = Math.min(mine[index] ?? 0, week.total);
          const current = index === last;
          return (
            <div
              key={week.week_start}
              className="flex flex-1 flex-col items-stretch justify-end"
              title={`${weekRange(week.week_start)}: ${week.total} team, ${yours} yours`}
            >
              <span
                className={`font-numeric mb-1 text-center text-[10px] ${
                  current ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {week.total || ""}
              </span>
              <motion.div
                className="relative overflow-hidden rounded-t-[4px]"
                style={{
                  background: current ? "rgba(214,168,68,0.38)" : "rgba(214,168,68,0.18)",
                }}
                initial={{ height: 0 }}
                whileInView={{
                  height: Math.max(week.total ? 3 : 0, (week.total / max) * barArea),
                }}
                viewport={{ once: true }}
                whileHover={{ filter: "brightness(1.25)" }}
                transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.1 + index * 0.06 }}
              >
                {week.total ? (
                  <div
                    className="absolute inset-x-0 bottom-0"
                    style={{
                      height: `${(yours / week.total) * 100}%`,
                      background: current ? "#e0b850" : "rgba(214,168,68,0.7)",
                    }}
                  />
                ) : null}
              </motion.div>
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="mt-2 flex gap-2 border-t border-border pt-2">
        {weeks.map((week, index) => (
          <span
            key={week.week_start}
            className={`flex-1 truncate text-center text-[10px] ${
              index === last ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {index === last ? "This wk" : shortDate(week.week_start)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Thin stacked bar of application statuses with a compact legend. */
export function StatusStrip({ counts }: { counts: Record<ApplicationStatus, number> }) {
  const statuses = Object.keys(STATUS_META) as ApplicationStatus[];
  const total = statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
  const filled = statuses.filter((status) => (counts[status] ?? 0) > 0);
  return (
    <div>
      <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full bg-secondary">
        {filled.map((status, index) => (
          <motion.span
            key={status}
            title={`${STATUS_META[status].label}: ${counts[status]}`}
            style={{ background: STATUS_META[status].color }}
            initial={{ width: 0 }}
            whileInView={{ width: `${(counts[status] / total) * 100}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.3 + index * 0.12 }}
          />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {statuses.map((status) => (
          <li key={status} className="flex items-center gap-1">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: STATUS_META[status].color,
                opacity: counts[status] ? 1 : 0.35,
              }}
            />
            {STATUS_META[status].label}
            <span className="font-numeric text-[#cdbfa3]">{counts[status] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Work-arrangement donut whose segments draw in one after another. */
export function ArrangementDonut({ counts }: { counts: Record<WorkArrangement, number> }) {
  const size = 112;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const entries = (Object.keys(ARRANGEMENT_META) as WorkArrangement[]).map((key) => ({
    key,
    ...ARRANGEMENT_META[key],
    value: counts[key] ?? 0,
  }));
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const filled = entries.filter((entry) => entry.value > 0);
  const gap = filled.length > 1 ? 3 : 0;
  const segments = filled.map((entry, index) => {
    const length = (entry.value / total) * circumference;
    const offset = filled
      .slice(0, index)
      .reduce((sum, previous) => sum + (previous.value / total) * circumference, 0);
    return { ...entry, length, offset };
  });

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-none" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#2e2113"
            strokeWidth={stroke}
          />
          {segments.map((segment, index) => (
            <motion.circle
              key={segment.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={stroke}
              strokeDashoffset={-segment.offset}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              whileInView={{
                strokeDasharray: `${Math.max(0, segment.length - gap)} ${circumference}`,
              }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.3 + index * 0.18 }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-numeric text-xl text-foreground">
            <CountUp value={total} />
          </span>
          <span className="text-[10px] text-muted-foreground">roles</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-[11px]">
        {entries.map((entry) => (
          <li key={entry.key} className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: entry.color }} />
            <span className="truncate">{entry.label}</span>
            <span className="font-numeric ml-auto pl-2 text-[#cdbfa3]">
              {total ? Math.round((entry.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
