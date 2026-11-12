// Small motion building blocks for the dashboard. They respect the user's
// reduced-motion setting through the MotionConfig in BentoDashboard.
import { type ReactNode, useEffect, useRef } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";

import { EASE_OUT, PANEL } from "./dashboardStyles";

/** Counts up to `value` once visible, and animates to any later value. */
export function CountUp({ value, duration = 1.1 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(reduce ? value : 0);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest));

  useEffect(() => {
    if (!inView && !reduce) return;
    if (reduce) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration, ease: EASE_OUT });
    return () => controls.stop();
  }, [inView, reduce, value, duration, motionValue]);

  return <motion.span ref={ref}>{rounded}</motion.span>;
}

/** A horizontal fill that grows to `pct` once visible. */
export function GrowBar({
  pct,
  color,
  delay = 0,
  className = "h-full rounded-full",
}: {
  pct: number;
  color: string;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      style={{ background: color }}
      initial={{ width: 0 }}
      whileInView={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      viewport={{ once: true }}
      transition={{ duration: 0.9, ease: EASE_OUT, delay }}
    />
  );
}

/** A dashboard tile that rises in, lifts on hover and glows under the cursor. */
export function SpotlightTile({
  className = "",
  delay = 0,
  children,
}: {
  className?: string;
  delay?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <motion.div
      ref={ref}
      onMouseMove={(event) => {
        const node = ref.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        node.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
        node.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
      }}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay }}
      className={`${PANEL} group relative overflow-hidden transition-colors hover:border-primary/30 ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 [background:radial-gradient(380px_circle_at_var(--spot-x,50%)_var(--spot-y,50%),color-mix(in_srgb,var(--primary)_11%,transparent),transparent_60%)]"
      />
      <div className="relative h-full">{children}</div>
    </motion.div>
  );
}
