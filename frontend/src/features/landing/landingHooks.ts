// Timing hooks that drive the landing page's looping demos.
import { type RefObject, useEffect, useState } from "react";
import {
  type MotionValue,
  useInView,
  useReducedMotion,
  useTime,
  useTransform,
} from "motion/react";

/**
 * A rotation angle that turns once every `ms`, plus its opposite, both from
 * one clock so children counter-rotating against a ring stay exactly upright.
 */
export function useSpin(ms: number): { angle: MotionValue<number>; counter: MotionValue<number> } {
  const time = useTime();
  const reduce = useReducedMotion();
  const angle = useTransform(time, (t) => (reduce ? 0 : ((t / ms) * 360) % 360));
  const counter = useTransform(angle, (value) => -value);
  return { angle, counter };
}

/**
 * Steps 0..steps-1 every `ms` while the element is on screen, then wraps.
 * Reduced-motion users get the final step, held still.
 */
export function useStepper(
  ref: RefObject<Element | null>,
  steps: number,
  ms: number,
): number {
  const inView = useInView(ref, { margin: "-10% 0px -10% 0px" });
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const id = window.setInterval(() => setStep((current) => (current + 1) % steps), ms);
    return () => window.clearInterval(id);
  }, [inView, reduce, steps, ms]);

  return reduce ? steps - 1 : step;
}

/** Cycles through `count` items on a timer. Reduced motion holds the first. */
export function useRotation(count: number, ms: number): number {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setIndex((current) => (current + 1) % count), ms);
    return () => window.clearInterval(id);
  }, [count, ms, reduce]);

  return reduce ? 0 : index;
}
