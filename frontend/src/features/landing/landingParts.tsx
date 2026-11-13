// Building blocks shared across the landing page sections.
import { type ReactNode, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Flame } from "lucide-react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";

import { ThemeToggle } from "../../app/theme/ThemeToggle";
import logoUrl from "../../assets/applytogether-logo.png";
import { EASE_OUT } from "../dashboard/dashboardStyles";
import { avatarColor, initials } from "../members/avatar";
import { crew } from "./landingData";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex flex-none items-center justify-center overflow-hidden rounded-lg bg-black p-0.5 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_28%,transparent)]"
      style={{ width: size, height: size }}
    >
      <img src={logoUrl} alt="" className="h-full w-full object-contain" />
    </span>
  );
}

/** In-page link that glides to a section (or jumps, for reduced motion). */
function SectionLink({ id, children }: { id: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <a
      href={`#${id}`}
      onClick={(event) => {
        const target = document.getElementById(id);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }}
      className="rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {children}
    </a>
  );
}

export function LandingNav() {
  const { scrollY } = useScroll();
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (latest) => setScrolled(latest > 12));

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled
          ? "border-b border-border bg-background/75 backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          to="/"
          onClick={() => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })}
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Logo />
          <span className="font-display text-[1.05rem] font-semibold tracking-tight text-foreground">
            ApplyTogether
          </span>
        </Link>
        <div className="ml-6 hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          <SectionLink id="mission">Mission</SectionLink>
          <SectionLink id="features">Features</SectionLink>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/login"
            className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-subtle transition-colors hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-10px_color-mix(in_srgb,var(--primary)_70%,transparent)] transition hover:bg-primary/90"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function CtaButtons({
  primary = "Start your crew",
  secondary = "Sign in",
  center = false,
}: {
  primary?: string;
  secondary?: string;
  center?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${center ? "justify-center" : ""}`}>
      <Link
        to="/signup"
        className="group inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-[0.95rem] font-semibold text-primary-foreground shadow-[0_12px_32px_-12px_color-mix(in_srgb,var(--primary)_80%,transparent)] transition hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {primary}
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </Link>
      <Link
        to="/login"
        className="inline-flex h-12 items-center rounded-xl border border-border bg-card/70 px-5 text-[0.95rem] font-semibold text-foreground backdrop-blur transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {secondary}
      </Link>
    </div>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <span className="flex items-center gap-2">
          <Logo size={24} />
          <span className="font-display font-semibold text-foreground">ApplyTogether</span>
        </span>
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em]">
          Accountable · Present · Active
        </span>
        <span>© {new Date().getFullYear()} ApplyTogether</span>
      </div>
    </footer>
  );
}

export function Avatar({
  id,
  size = 32,
  ring = false,
}: {
  id: string;
  size?: number;
  ring?: boolean;
}) {
  const member = crew(id);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-none items-center justify-center rounded-full font-semibold text-white ${
        ring ? "ring-2 ring-background" : ""
      }`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: avatarColor(member.id),
      }}
    >
      {initials(member.name)}
    </span>
  );
}

export function AvatarStack({ ids, size = 30 }: { ids: string[]; size?: number }) {
  return (
    <span className="flex -space-x-2">
      {ids.map((id, index) => (
        <motion.span
          key={id}
          initial={{ opacity: 0, scale: 0.4, x: -8 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ delay: 0.5 + index * 0.08, type: "spring", stiffness: 380, damping: 22 }}
        >
          <Avatar id={id} size={size} ring />
        </motion.span>
      ))}
    </span>
  );
}

/** Progress ring that sweeps to done/goal. */
export function GoalRing({
  done,
  goal,
  size = 120,
  stroke = 10,
  color = "var(--primary)",
  children,
}: {
  done: number;
  goal: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const pct = Math.max(0, Math.min(1, goal ? done / goal : 0));
  return (
    <span className="relative inline-flex flex-none items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: pct }}
          transition={{ duration: 0.8, ease: EASE_OUT }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</span>
    </span>
  );
}

export function StreakFlame({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <Flame
      size={size}
      aria-hidden="true"
      className={`dashboard-flicker text-[var(--warning)] ${className}`}
      fill="currentColor"
      fillOpacity={0.25}
    />
  );
}

/** A faux app window that frames each product demo. */
export function DemoFrame({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border bg-card text-left shadow-[var(--shadow-raised)] ring-1 ring-inset ring-white/[0.03] ${className}`}
    >
      {title ? (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--track)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--track)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--track)]" />
          </span>
          <span className="ml-1 text-[11px] font-medium text-muted-foreground">{title}</span>
        </div>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

/** Small uppercase label above a section heading. */
export function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.07] px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
      {children}
    </p>
  );
}

/** Fades and lifts its children in when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  className = "",
  y = 24,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}
