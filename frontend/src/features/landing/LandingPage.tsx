// The public landing page, shown at / to signed-out visitors. Mission and
// people first: a crew orbits a shared weekly goal, live activity stacks up
// like notifications, three promises each get a live demo of the product,
// and visitors can make a weekly pledge before signing up.
import { useRef } from "react";
import { BellRing, Flame, Send, Sparkles, Target, UserPlus } from "lucide-react";
import { AnimatePresence, MotionConfig, motion, useScroll, useSpring } from "motion/react";

import { AutofillDemo, GoalDemo, TailorDemo, TeamDemo, WallDemo } from "./demos";
import { LandingHero } from "./LandingHero";
import { ACTIVITY, type ActivityItem, PILLARS, crew } from "./landingData";
import { useSpin, useStepper } from "./landingHooks";
import { ringPoint, wrapIndex } from "./landingModel";
import {
  Avatar,
  AvatarStack,
  CtaButtons,
  Kicker,
  LandingFooter,
  LandingNav,
  Reveal,
  StreakFlame,
} from "./landingParts";
import { Pledge } from "./Pledge";
import "./landing.css";

/* ---------------------------------------------------------- Live stack */

const KIND_ICON: Record<ActivityItem["kind"], typeof Send> = {
  sent: Send,
  goal: Target,
  streak: Flame,
  tailor: Sparkles,
  nudge: BellRing,
  invite: UserPlus,
};

const STACK_DEPTH = 4;

function LiveStack() {
  const ref = useRef<HTMLDivElement>(null);
  const step = useStepper(ref, ACTIVITY.length * 10, 2200);
  const visible = Array.from({ length: STACK_DEPTH }, (_, offset) => ({
    item: ACTIVITY[wrapIndex(step - offset, ACTIVITY.length)],
    key: step - offset,
    offset,
  }));

  return (
    <section className="relative border-y border-border bg-secondary/40 px-4 py-24 sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <Kicker>Right now, in a crew like yours</Kicker>
          <h2 className="font-display text-balance text-4xl font-bold tracking-[-0.03em] text-foreground sm:text-5xl">
            Every application is a little louder when someone notices.
          </h2>
          <p className="mt-4 max-w-md text-pretty text-base leading-7 text-subtle">
            Your workspace shows what your crew is doing as it happens: applications sent, goals hit, streaks
            kept and friendly nudges. Momentum is contagious.
          </p>
        </Reveal>
        <div ref={ref} className="relative mx-auto h-[19rem] w-full max-w-md" aria-hidden="true">
          <AnimatePresence initial={false}>
            {visible.map(({ item, key, offset }) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <motion.div
                  key={key}
                  className="absolute inset-x-0 top-0 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-raised)]"
                  style={{ zIndex: 10 - offset }}
                  initial={{ opacity: 0, y: -40, scale: 1.04 }}
                  animate={{ opacity: 1 - offset * 0.22, y: offset * 72, scale: 1 - offset * 0.04 }}
                  exit={{ opacity: 0, y: STACK_DEPTH * 72, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                >
                  <Avatar id={item.who} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-subtle">
                      <strong className="font-semibold text-foreground">{crew(item.who).name.split(" ")[0]}</strong>{" "}
                      {item.text}
                    </p>
                    <p className="text-xs text-muted-foreground">{offset === 0 ? "just now" : `${offset * 4}m ago`}</p>
                  </div>
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon size={16} />
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Promises */

const PROMISE_DEMOS = {
  accountable: <TeamDemo />,
  present: <GoalDemo />,
  active: <AutofillDemo />,
} as const;

function Promises() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.7", "end 0.6"] });
  const line = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  return (
    <section id="mission" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-28 sm:px-6">
      <Reveal className="mx-auto mb-20 max-w-2xl text-center">
        <Kicker>Our three promises</Kicker>
        <h2 className="font-display text-balance text-4xl font-bold tracking-[-0.03em] text-foreground sm:text-5xl">
          We'll help you keep showing up.
        </h2>
        <p className="mt-4 text-pretty text-base leading-7 text-subtle">
          Most job searches don't fail in an interview. They fade out quietly. Everything in ApplyTogether is
          built around three promises to stop that from happening.
        </p>
      </Reveal>
      <div ref={ref} className="relative">
        <span aria-hidden="true" className="absolute bottom-0 left-5 top-0 hidden w-px bg-border md:block lg:left-1/2" />
        <motion.span
          aria-hidden="true"
          className="absolute left-5 top-0 hidden h-full w-px origin-top bg-primary md:block lg:left-1/2"
          style={{ scaleY: line }}
        />
        <div className="space-y-24">
          {PILLARS.map((pillar, index) => (
            <div key={pillar.key} className="relative grid items-center gap-10 md:pl-16 lg:grid-cols-2 lg:gap-24 lg:pl-0">
              <motion.span
                aria-hidden="true"
                className="absolute left-5 top-2 hidden h-4 w-4 -translate-x-1/2 rounded-full border-4 border-background bg-primary md:block lg:left-1/2 lg:top-1/2 lg:-translate-y-1/2"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true, margin: "-120px" }}
                transition={{ type: "spring", stiffness: 400, damping: 16 }}
              />
              <Reveal className={index % 2 === 1 ? "lg:order-2" : ""}>
                <span aria-hidden="true" className="font-display block text-7xl font-bold leading-none tracking-[-0.05em] text-primary/20">
                  0{index + 1}
                </span>
                <h3 className="font-display mt-2 text-4xl font-bold tracking-[-0.03em] text-foreground">{pillar.word}</h3>
                <p className="mt-2 text-lg font-semibold text-primary">{pillar.line}</p>
                <p className="mt-3 max-w-md text-base leading-7 text-subtle">{pillar.text}</p>
              </Reveal>
              <Reveal delay={0.12} className={index % 2 === 1 ? "lg:order-1" : ""}>
                {PROMISE_DEMOS[pillar.key]}
              </Reveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Toolkit */

function Toolkit() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-28 sm:px-6">
      <Reveal className="mb-10 max-w-2xl">
        <Kicker>And help with the hard parts</Kicker>
        <h2 className="font-display text-balance text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-4xl">
          One wall for the whole crew. A sharper résumé for every role.
        </h2>
      </Reveal>
      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal>
          <WallDemo />
        </Reveal>
        <Reveal delay={0.1}>
          <TailorDemo />
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- CTA */

const CTA_ORBIT = ["maya", "dev", "priya", "sam"];

function FinalCta() {
  const spin = useSpin(14000);
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:radial-gradient(45%_60%_at_50%_50%,color-mix(in_srgb,var(--primary)_14%,transparent),transparent_70%)]"
      />
      <Reveal className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-28 text-center sm:px-6">
        <div className="relative mb-8 h-28 w-28" aria-hidden="true">
          <motion.div className="absolute inset-0" style={{ rotate: spin.angle }}>
            {CTA_ORBIT.map((id, index) => (
              <span key={id} className="absolute" style={ringPoint(index * 90 - 90)}>
                <motion.span className="block -translate-x-1/2 -translate-y-1/2" style={{ rotate: spin.counter }}>
                  <Avatar id={id} size={30} ring />
                </motion.span>
              </span>
            ))}
          </motion.div>
          <span className="absolute inset-[30%] flex items-center justify-center rounded-full bg-[var(--warning)]/10">
            <StreakFlame size={24} />
          </span>
        </div>
        <h2 className="font-display text-balance text-4xl font-bold tracking-[-0.03em] text-foreground sm:text-6xl">
          Nobody should job hunt alone.
        </h2>
        <p className="mt-4 max-w-lg text-pretty text-base leading-7 text-subtle">
          Start a workspace, invite your people and make your first pledge. We'll help you keep it.
        </p>
        <div className="mt-8 flex flex-col items-center gap-5">
          <CtaButtons center primary="Start your circle" />
          <span className="flex items-center gap-3 text-sm text-muted-foreground">
            <AvatarStack ids={["leo", "ana", "noor", "jules"]} size={26} />
            Better with friends
          </span>
        </div>
      </Reveal>
    </section>
  );
}

export function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-background text-foreground">
        <LandingNav />
        <main>
          <LandingHero />
          <LiveStack />
          <Promises />
          <Toolkit />
          <Pledge />
          <FinalCta />
        </main>
        <LandingFooter />
      </div>
    </MotionConfig>
  );
}
