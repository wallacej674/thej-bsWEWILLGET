// The landing hero: the mission headline beside a crew of avatars orbiting a
// shared weekly goal, each one pinging "+1 sent" in turn.
import { useRef } from "react";
import { AnimatePresence, type MotionValue, motion } from "motion/react";

import { CountUp } from "../dashboard/motion";
import { EASE_OUT } from "../dashboard/dashboardStyles";
import { useRotation, useSpin, useStepper } from "./landingHooks";
import { ringPoint } from "./landingModel";
import { Avatar, CtaButtons, GoalRing, Kicker } from "./landingParts";

const WORDS = ["accountable", "present", "active"];

function RotatingWord() {
  const index = useRotation(WORDS.length, 2400);
  return (
    <span className="relative inline-grid [perspective:600px]">
      {/* Holds the width of the longest word so the line never reflows. */}
      <span className="invisible col-start-1 row-start-1">{WORDS[0]}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={WORDS[index]}
          className="landing-gradient-text landing-pan col-start-1 row-start-1 pb-2"
          initial={{ y: "55%", opacity: 0, rotateX: -70 }}
          animate={{ y: 0, opacity: 1, rotateX: 0 }}
          exit={{ y: "-55%", opacity: 0, rotateX: 70 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        >
          {WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const OUTER = ["maya", "dev", "priya", "sam", "leo"];
const INNER = ["ana", "noor", "jules"];
const EVERYONE = [...OUTER, ...INNER];
const ORBIT_GOAL = 30;
const ORBIT_START = 17;
// The shared count climbs from 17 to 30 and starts over; 56 steps lines that
// loop up with the eight members taking turns.
const ORBIT_STEPS = 56;

function Orbiter({
  id,
  angle,
  pinging,
  step,
  upright,
}: {
  id: string;
  angle: number;
  pinging: boolean;
  step: number;
  /** The ring's rotation, reversed, so the avatar stays upright. */
  upright: MotionValue<number>;
}) {
  return (
    <span className="absolute" style={ringPoint(angle)}>
      <motion.span style={{ rotate: upright }} className="block -translate-x-1/2 -translate-y-1/2">
        <span className="relative block">
          {pinging ? (
            <span aria-hidden="true" className="landing-ping absolute inset-0 rounded-full bg-primary/50" />
          ) : null}
          <span className="relative block rounded-full shadow-[var(--shadow-raised)]">
            <Avatar id={id} size={44} ring />
          </span>
          <AnimatePresence>
            {pinging ? (
              <motion.span
                key={step}
                className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground"
                initial={{ opacity: 0, y: 8, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: "spring", stiffness: 420, damping: 20 }}
              >
                +1 sent
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
      </motion.span>
    </span>
  );
}

function Orbit() {
  const ref = useRef<HTMLDivElement>(null);
  const step = useStepper(ref, ORBIT_STEPS, 1600);
  const outer = useSpin(60000);
  const inner = useSpin(40000);
  const pinging = EVERYONE[(step * 3) % EVERYONE.length];
  const sent = ORBIT_START + (step % (ORBIT_GOAL - ORBIT_START + 1));

  return (
    <div ref={ref} className="relative mx-auto aspect-square w-[min(84vw,30rem)]" aria-hidden="true">
      <div className="absolute inset-0 rounded-full [background:radial-gradient(closest-side,color-mix(in_srgb,var(--primary)_16%,transparent),transparent)]" />
      <div className="absolute inset-[6%] rounded-full border border-dashed border-primary/30" />
      <div className="absolute inset-[26%] rounded-full border border-primary/20 bg-card/40" />
      {/* Comets that lap each ring. */}
      <svg
        className="landing-orbit absolute inset-[6%]"
        style={{ ["--orbit-duration" as string]: "7s" }}
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="49.6" fill="none" stroke="var(--primary)" strokeWidth="0.7" strokeLinecap="round" strokeDasharray="40 272" />
      </svg>
      <svg
        className="landing-orbit-counter absolute inset-[26%]"
        style={{ ["--orbit-duration" as string]: "5s" }}
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="49.4" fill="none" stroke="var(--chart-3)" strokeWidth="0.9" strokeLinecap="round" strokeDasharray="30 280" />
      </svg>

      <motion.div className="absolute inset-[6%]" style={{ rotate: outer.angle }}>
        {OUTER.map((id, index) => (
          <Orbiter key={id} id={id} angle={index * 72 - 90} pinging={pinging === id} step={step} upright={outer.counter} />
        ))}
      </motion.div>
      {/* The inner ring turns the other way. */}
      <motion.div className="absolute inset-[26%]" style={{ rotate: inner.counter }}>
        {INNER.map((id, index) => (
          <Orbiter key={id} id={id} angle={index * 120 + 30} pinging={pinging === id} step={step} upright={inner.angle} />
        ))}
      </motion.div>

      <div className="absolute inset-[38%] flex items-center justify-center">
        <div className="rounded-full bg-card p-2 shadow-[var(--shadow-raised)]">
          <GoalRing done={sent} goal={ORBIT_GOAL} size={132} stroke={10}>
            <span className="font-display text-3xl font-bold leading-none text-foreground">
              <CountUp value={sent} duration={0.5} />
            </span>
            <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              sent together
            </span>
          </GoalRing>
        </div>
      </div>
    </div>
  );
}

const HEADLINE = ["Stay", <RotatingWord key="word" />, "together."];

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-28 sm:pt-32">
      <div
        aria-hidden="true"
        className="landing-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_60%_at_75%_40%,black,transparent)]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-24 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }}>
            <Kicker>A mission, not just a tracker</Kicker>
          </motion.div>
          <h1 className="font-display text-[3.2rem] font-bold leading-[0.98] tracking-[-0.04em] text-foreground sm:text-7xl lg:text-[5.4rem]">
            <span className="sr-only">Stay accountable, present and active, together.</span>
            <span aria-hidden="true">
              {HEADLINE.map((line, index) => (
                <motion.span
                  key={index}
                  className="block"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.05 + index * 0.1 }}
                >
                  {line}
                </motion.span>
              ))}
            </span>
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.4 }}
            className="mt-7 max-w-lg text-pretty text-base leading-7 text-subtle sm:text-lg"
          >
            ApplyTogether is a shared job-search workspace for friends, cohorts and career clubs. Set weekly
            goals, see who's showing up, and keep each other going until everyone lands.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.5 }}
            className="mt-8"
          >
            <CtaButtons primary="Join the circle" />
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotate: -20 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.2 }}
        >
          <Orbit />
        </motion.div>
      </div>
    </section>
  );
}
