// "Make a pledge": visitors drag a weekly goal and see what keeping it for
// twelve weeks looks like.
import { useId, useRef, useState } from "react";
import { Check, Flame } from "lucide-react";
import { motion, useInView } from "motion/react";

import { CountUp } from "../dashboard/motion";
import { EASE_OUT } from "../dashboard/dashboardStyles";
import { PLEDGE_MAX, PLEDGE_MIN, pledgeStats } from "./landingModel";
import { Kicker, Reveal, StreakFlame } from "./landingParts";

const PROMISES = [
  "Your ring resets every Monday",
  "Your crew sees your pace",
  "Miss a week? Start again the next",
];

export function Pledge() {
  const [goal, setGoal] = useState(5);
  const sliderId = useId();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartSeen = useInView(chartRef, { once: true, margin: "-60px" });
  const stats = pledgeStats(goal);

  return (
    <section className="relative overflow-hidden border-y border-border bg-secondary/40 px-4 py-24 sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <Kicker>Make a pledge</Kicker>
          <h2 className="font-display text-balance text-4xl font-bold tracking-[-0.03em] text-foreground sm:text-5xl">
            How many will you send each week?
          </h2>
          <p className="mt-4 max-w-md text-pretty text-base leading-7 text-subtle">
            Pick a number you can keep. Small and steady beats a burst and a burnout, and your crew will help you
            stick to it.
          </p>
          <div className="mt-8 max-w-md">
            <div className="flex items-baseline justify-between">
              <label htmlFor={sliderId} className="text-sm font-semibold text-subtle">
                My weekly goal
              </label>
              <motion.output
                key={stats.goal}
                htmlFor={sliderId}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="font-display text-4xl font-bold text-primary"
              >
                {stats.goal}
              </motion.output>
            </div>
            <input
              id={sliderId}
              type="range"
              min={PLEDGE_MIN}
              max={PLEDGE_MAX}
              value={stats.goal}
              onChange={(event) => setGoal(Number(event.target.value))}
              className="mt-3 w-full accent-[var(--primary)]"
            />
            <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                { value: stats.perDay, label: "a day, at most" },
                { value: stats.total, label: `in ${stats.weeks} weeks` },
                { value: stats.weeks, label: "week streak" },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col-reverse rounded-xl border border-border bg-card p-3">
                  <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                  <dd className="font-display text-2xl font-bold text-foreground">
                    <CountUp value={stat.value} duration={0.5} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-raised)]">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Twelve weeks of keeping it</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--warning)]">
                <StreakFlame size={15} /> <CountUp value={stats.weeks} /> weeks
              </span>
            </div>
            <div ref={chartRef} className="flex h-52 items-end gap-1.5" aria-hidden="true">
              {Array.from({ length: stats.weeks }, (_, index) => (
                <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <motion.span
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + index * 0.06 }}
                  >
                    <Flame size={11} className="text-[var(--warning)]" fill="currentColor" fillOpacity={0.3} />
                  </motion.span>
                  <motion.span
                    className="w-full rounded-t-md bg-primary"
                    initial={{ height: 0 }}
                    animate={{ height: chartSeen ? `${stats.barPct}%` : 0 }}
                    transition={{ duration: 0.6, ease: EASE_OUT, delay: index * 0.04 }}
                    style={{ opacity: 0.45 + (index / stats.weeks) * 0.55 }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>Week 1</span>
              <span>Week {stats.weeks}</span>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-subtle">
              {PROMISES.map((line) => (
                <li key={line} className="flex items-center gap-2">
                  <Check size={14} className="text-[var(--success)]" aria-hidden="true" /> {line}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
