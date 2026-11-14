// The logo inside a goal ring that fills as a form is completed, spins while
// the form is being checked, and closes green with a check when it's done.
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";

import logoUrl from "../../assets/applytogether-logo.png";
import { EASE_OUT } from "../dashboard/dashboardStyles";
import type { RingTone } from "./signInModel";
import "./auth-motion.css";

const SIZE = 172;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const LOGO = 84;

const TONE_COLOR: Record<RingTone, string> = {
  primary: "var(--primary)",
  success: "var(--success)",
  destructive: "var(--destructive)",
};

function DrawnCheck() {
  return (
    <svg width={40} height={40} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.1 }}
      />
    </svg>
  );
}

export function AuthGoalRing({
  progress,
  tone,
  spinning,
  done,
}: {
  /** How full the ring is, 0..1. */
  progress: number;
  tone: RingTone;
  /** Shows a spinning arc, for while the form is being checked. */
  spinning: boolean;
  /** Closes the ring and swaps the logo for a check. */
  done: boolean;
}) {
  const color = TONE_COLOR[tone];
  const fill = done ? 1 : Math.max(0, Math.min(1, progress));

  return (
    <motion.div
      className="relative"
      style={{ width: SIZE, height: SIZE }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-4 rounded-full blur-2xl"
        style={{ background: color }}
        animate={{ opacity: 0.12 + fill * 0.28 }}
        transition={{ duration: 0.6 }}
      />
      <svg width={SIZE} height={SIZE} className="relative -rotate-90" aria-hidden="true">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--track)" strokeWidth={STROKE} />
        <motion.circle
          data-testid="goal-ring-fill"
          data-progress={fill}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          // A zero-length round-capped stroke still draws a dot, so hide it at 0.
          animate={{ pathLength: fill, stroke: color, opacity: fill > 0 ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
        />
      </svg>
      {spinning ? (
        <svg width={SIZE} height={SIZE} className="auth-spin absolute inset-0" aria-hidden="true">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS + STROKE + 3}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2.5}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="18 82"
          />
        </svg>
      ) : null}
      <AnimatePresence>
        {done ? (
          <motion.span
            key="burst"
            aria-hidden="true"
            className="absolute inset-0 rounded-full border-2 border-[var(--success)]"
            initial={{ scale: 0.9, opacity: 0.9 }}
            animate={{ scale: 1.45, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: EASE_OUT }}
          />
        ) : null}
      </AnimatePresence>
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.span
              key="done"
              className="flex items-center justify-center rounded-full bg-[var(--success)] text-white shadow-[0_14px_44px_-10px_var(--success)]"
              style={{ width: LOGO, height: LOGO }}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
            >
              <DrawnCheck />
            </motion.span>
          ) : (
            <motion.span
              key="logo"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
            >
              <Link
                to="/"
                className="flex items-center justify-center overflow-hidden rounded-2xl bg-black p-1 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_28%,transparent),0_14px_44px_-10px_color-mix(in_srgb,var(--primary)_40%,transparent)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                style={{ width: LOGO, height: LOGO }}
              >
                <img src={logoUrl} alt="ApplyTogether home" className="h-full w-full object-contain" />
              </Link>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
