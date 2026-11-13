// Self-playing miniatures of real ApplyTogether features. Each loops while it
// is on screen and holds its final frame for reduced motion.
import { useId, useRef } from "react";
import { BellRing, Check, Sparkles, TriangleAlert, X } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";

import { tint } from "../../app/theme/color";
import { Monogram, StatusBadge } from "../applications/wall/wallParts";
import { CountUp } from "../dashboard/motion";
import { EASE_OUT, EYEBROW } from "../dashboard/dashboardStyles";
import { WALL, crew } from "./landingData";
import { useStepper } from "./landingHooks";
import { type MatchVerdict, type Pace, matchVerdict, paceOf, wrapIndex } from "./landingModel";
import { Avatar, DemoFrame, GoalRing, StreakFlame } from "./landingParts";

/* ------------------------------------------------------------ Autofill */

const POSTING_URL = "careers.northwind.com/jobs/product-analyst";
const AUTOFILL_FIELDS: [string, string][] = [
  ["Company", "Northwind"],
  ["Job title", "Product Analyst"],
  ["Location", "Chicago, IL"],
  ["Arrangement", "Hybrid"],
  ["Salary", "$95K–$115K/yr"],
  ["Type", "Full time"],
];

export function AutofillDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const t = useStepper(ref, 70, 100);
  const typed = Math.min(POSTING_URL.length, t * 2);
  const pressing = t >= 23 && t < 26;
  const filled = t < 26 ? 0 : Math.min(AUTOFILL_FIELDS.length, Math.floor((t - 26) / 3) + 1);
  const done = filled === AUTOFILL_FIELDS.length;

  return (
    <div ref={ref}>
      <DemoFrame title="New application">
        <p className={`${EYEBROW} mb-1.5`}>Job posting link</p>
        <div className="flex gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-border bg-input px-3 text-[13px] text-foreground">
            <span className="truncate">{POSTING_URL.slice(0, typed)}</span>
            {typed < POSTING_URL.length ? (
              <span aria-hidden="true" className="ml-px h-4 w-px animate-pulse bg-primary" />
            ) : null}
          </div>
          <motion.span
            animate={{ scale: pressing ? 0.92 : 1 }}
            className="inline-flex h-10 flex-none items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground"
          >
            <Sparkles size={14} aria-hidden="true" /> Autofill
          </motion.span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3">
          {AUTOFILL_FIELDS.map(([label, value], index) => (
            <div key={label} className="min-w-0">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</p>
              <div className="relative flex h-9 items-center overflow-hidden rounded-lg border border-border bg-input px-2.5 text-[13px]">
                {index < filled ? (
                  <>
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 bg-primary/15"
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 0.9 }}
                    />
                    <motion.span
                      className="relative truncate text-foreground"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: EASE_OUT }}
                    >
                      {value}
                    </motion.span>
                  </>
                ) : (
                  <span className="landing-shimmer-bar landing-shimmer h-2.5 w-2/3 rounded-full" />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 h-5 text-[12px]">
          <AnimatePresence>
            {done ? (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 font-medium text-[var(--success)]"
              >
                <Check size={14} aria-hidden="true" /> Filled {AUTOFILL_FIELDS.length} fields from the posting
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </DemoFrame>
    </div>
  );
}

/* ---------------------------------------------------------------- Wall */

const WALL_TILES = 6;

export function WallDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const step = useStepper(ref, WALL.length, 1800);
  const items = Array.from({ length: WALL_TILES }, (_, index) => WALL[wrapIndex(step - index, WALL.length)]);

  return (
    <div ref={ref}>
      <DemoFrame title="Applications · Company wall">
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
          {["All", "Applied", "Remote", "Mine"].map((pill, index) => (
            <span
              key={pill}
              className={`rounded-full border px-2.5 py-1 font-medium ${
                index === 0
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {pill}
            </span>
          ))}
          <span className="ml-auto text-muted-foreground">
            <CountUp value={38 + step} /> on the wall
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {items.map((entry, index) => (
              <motion.li
                key={entry.company}
                layout
                initial={{ opacity: 0, scale: 0.6, y: -16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: "spring", stiffness: 360, damping: 28, delay: step === 0 ? index * 0.06 : 0 }}
                className={`relative min-w-0 rounded-xl border bg-card p-3 ${
                  index === 0 ? "border-primary/40 shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_10%,transparent)]" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between">
                  <Monogram name={entry.company} size={30} />
                  <Avatar id={entry.owner} size={20} />
                </div>
                <p className="mt-2 truncate text-[13px] font-semibold text-foreground">{entry.company}</p>
                <p className="truncate text-[11px] text-muted-foreground">{entry.role}</p>
                <div className="mt-2 flex items-center gap-1">
                  <StatusBadge status="applied" />
                  {index === 0 ? (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      New
                    </span>
                  ) : null}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </DemoFrame>
    </div>
  );
}

/* ---------------------------------------------------------------- Goal */

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function GoalDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const step = useStepper(ref, 9, 900);
  const goal = 5;
  const done = Math.min(step, goal);
  const hit = done >= goal;
  const streak = hit ? 6 : 5;

  return (
    <div ref={ref}>
      <DemoFrame title="Overview · Your week">
        <div className="flex flex-wrap items-center gap-5">
          <span className="relative">
            <GoalRing done={done} goal={goal} size={128} stroke={11} color={hit ? "var(--success)" : "var(--primary)"}>
              <span className="font-display text-3xl font-semibold leading-none text-foreground">
                <motion.span key={done} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-block">
                  {done}
                </motion.span>
                <span className="text-lg text-muted-foreground">/{goal}</span>
              </span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">sent</span>
            </GoalRing>
            <AnimatePresence>
              {hit ? (
                <motion.span
                  key="burst"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full border-2 border-[var(--success)]"
                  initial={{ scale: 0.8, opacity: 0.9 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: EASE_OUT }}
                />
              ) : null}
            </AnimatePresence>
          </span>
          <div className="min-w-0 flex-1">
            <p className={EYEBROW}>Weekly goal</p>
            <p className="mt-1.5 text-sm font-medium leading-snug text-foreground">
              {hit
                ? "Goal hit. Anything more is a bonus."
                : `${goal - done} more by Sunday keeps your 5-week streak alive.`}
            </p>
            <motion.span
              key={streak}
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 14 }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-2.5 py-1 text-[12px] font-semibold text-[var(--warning)]"
            >
              <StreakFlame size={14} /> {streak}-week streak
            </motion.span>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-7 gap-1.5">
          {DAYS.map((day, index) => (
            <div key={index} className="text-center">
              <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--track)]">
                <motion.span
                  className="block h-full origin-left rounded-full"
                  style={{ background: hit ? "var(--success)" : "var(--primary)" }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: index < done ? 1 : 0 }}
                  transition={{ duration: 0.5, ease: EASE_OUT }}
                />
              </span>
              <span className="mt-1 block text-[10px] text-muted-foreground">{day}</span>
            </div>
          ))}
        </div>
      </DemoFrame>
    </div>
  );
}

/* ---------------------------------------------------------------- Team */

const PACE: Record<Pace, { label: string; color: string }> = {
  hit: { label: "Goal hit", color: "var(--success)" },
  on: { label: "On pace", color: "var(--primary)" },
  behind: { label: "Behind", color: "var(--warning)" },
};
// The demo week is frozen on a Friday.
const DEMO_DAY = 4;

const SNAPSHOTS: [string, number, number][][] = [
  [["maya", 5, 5], ["dev", 3, 5], ["priya", 2, 4], ["sam", 1, 6]],
  [["maya", 6, 5], ["dev", 4, 5], ["priya", 3, 4], ["sam", 3, 6]],
  [["maya", 6, 5], ["dev", 5, 5], ["priya", 4, 4], ["sam", 5, 6]],
];

export function TeamDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const step = useStepper(ref, 6, 1500);
  const snapshot = SNAPSHOTS[Math.floor(step / 2)];
  const total = snapshot.reduce((sum, [, done]) => sum + done, 0);
  const nudging = step === 1;

  return (
    <div ref={ref} className="relative">
      <DemoFrame title="Overview · Team this week">
        <div className="mb-3 flex items-baseline justify-between">
          <p className={EYEBROW}>Team sent</p>
          <p className="font-display text-2xl font-semibold text-foreground">
            <CountUp value={total} duration={0.6} />
          </p>
        </div>
        <ul className="space-y-3">
          {snapshot.map(([id, done, goal]) => {
            const pace = paceOf(done, goal, DEMO_DAY);
            const meta = PACE[pace];
            return (
              <li key={id} className="flex items-center gap-3">
                <span className="relative">
                  <Avatar id={id} size={28} />
                  {pace === "hit" ? (
                    <span aria-hidden="true" className="dashboard-glow absolute inset-0 rounded-full" />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="truncate font-medium text-foreground">{crew(id).name.split(" ")[0]}</span>
                    <span className="text-muted-foreground">
                      {done}/{goal}
                    </span>
                  </div>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--track)]">
                    <motion.span
                      className="block h-full rounded-full"
                      style={{ background: meta.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (done / goal) * 100)}%` }}
                      transition={{ duration: 0.8, ease: EASE_OUT }}
                    />
                  </span>
                </div>
                <motion.span
                  key={pace}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-[4.6rem] flex-none rounded-full px-2 py-0.5 text-center text-[10px] font-semibold"
                  style={{ color: meta.color, background: tint(meta.color, 12) }}
                >
                  {meta.label}
                </motion.span>
              </li>
            );
          })}
        </ul>
      </DemoFrame>
      <AnimatePresence>
        {nudging ? (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute -bottom-4 right-3 flex items-center gap-2 rounded-xl border border-border bg-popover px-3 py-2 text-[12px] text-popover-foreground shadow-[var(--shadow-raised)]"
          >
            <BellRing size={14} className="text-primary" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Ana</strong> nudged Sam: two more by Sunday
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------- Tailor */

const KEYWORDS: { word: string; found: boolean }[] = [
  { word: "SQL", found: true },
  { word: "Python", found: true },
  { word: "Looker", found: false },
  { word: "A/B testing", found: true },
  { word: "dbt", found: false },
  { word: "Stakeholders", found: true },
];

const VERDICT: Record<MatchVerdict, { label: string; color: string }> = {
  strong: { label: "Strong match", color: "var(--success)" },
  good: { label: "Good match", color: "var(--primary)" },
  weak: { label: "Weak match", color: "var(--warning)" },
};

export function TailorDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const group = useId();
  const step = useStepper(ref, 10, 900);
  const scanning = step === 0;
  const revealed = Math.min(KEYWORDS.length, step * 2);
  const shown = KEYWORDS.slice(0, revealed);
  const score = scanning ? 0 : Math.round((shown.filter((k) => k.found).length / KEYWORDS.length) * 100 * 1.17);
  const { label, color } = VERDICT[matchVerdict(score)];

  return (
    <div ref={ref}>
      <DemoFrame title="Résumé tailor · Northwind">
        <div className="flex items-center gap-4">
          <GoalRing done={score} goal={100} size={92} stroke={8} color={color}>
            <span className="font-display text-xl font-semibold text-foreground">
              <CountUp value={score} duration={0.6} />%
            </span>
          </GoalRing>
          <div className="min-w-0">
            <p className={EYEBROW}>Match</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: scanning ? "var(--muted-foreground)" : color }}>
              {scanning ? "Comparing your résumé…" : label}
            </p>
            <div className="relative mt-2 h-10 w-40 overflow-hidden rounded-md border border-border bg-input p-1.5">
              {[0, 1, 2].map((line) => (
                <span key={line} className="mb-1 block h-1.5 rounded-full bg-[var(--track)]" style={{ width: `${90 - line * 18}%` }} />
              ))}
              {scanning ? (
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-3 bg-primary/25"
                  animate={{ y: [0, 28, 0] }}
                  transition={{ duration: 0.9, ease: "easeInOut" }}
                />
              ) : null}
            </div>
          </div>
        </div>
        <LayoutGroup id={group}>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
            {[true, false].map((found) => (
              <div key={String(found)} className="min-w-0">
                <p className="mb-1.5 font-medium text-muted-foreground">
                  {found ? "Already on your résumé" : "Missing from your résumé"}
                </p>
                <ul className="flex min-h-[3.5rem] flex-wrap content-start gap-1.5">
                  <AnimatePresence>
                    {shown
                      .filter((keyword) => keyword.found === found)
                      .map((keyword) => (
                        <motion.li
                          key={keyword.word}
                          layout
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: "spring", stiffness: 420, damping: 24 }}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium"
                          style={{
                            color: found ? "var(--success)" : "var(--warning)",
                            borderColor: tint(found ? "var(--success)" : "var(--warning)", 35),
                            background: tint(found ? "var(--success)" : "var(--warning)", 10),
                          }}
                        >
                          {found ? <Check size={11} aria-hidden="true" /> : <X size={11} aria-hidden="true" />}
                          {keyword.word}
                        </motion.li>
                      ))}
                  </AnimatePresence>
                </ul>
              </div>
            ))}
          </div>
        </LayoutGroup>
        <div className="mt-3 min-h-[4.5rem] space-y-2 text-[12px]">
          <AnimatePresence>
            {step >= 4 ? (
              <motion.p
                key="bullet"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-subtle"
              >
                <span className="mr-1 font-semibold text-foreground">Suggested bullet:</span>
                Built SQL reporting that answered weekly product questions for three teams.
              </motion.p>
            ) : null}
            {step >= 6 ? (
              <motion.p
                key="caution"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-1.5 text-[var(--warning)]"
              >
                <TriangleAlert size={13} className="mt-0.5 flex-none" aria-hidden="true" />
                Only add Looker if you have really used it.
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </DemoFrame>
    </div>
  );
}
