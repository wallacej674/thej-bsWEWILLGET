import { describe, expect, it } from "vitest";

import {
  PLEDGE_MAX,
  PLEDGE_MIN,
  matchVerdict,
  paceOf,
  pledgeStats,
  ringPoint,
  wrapIndex,
} from "./landingModel";

describe("wrapIndex", () => {
  it("wraps forwards and backwards round a list", () => {
    expect(wrapIndex(0, 4)).toBe(0);
    expect(wrapIndex(5, 4)).toBe(1);
    expect(wrapIndex(-1, 4)).toBe(3);
    expect(wrapIndex(-9, 4)).toBe(3);
  });
});

describe("ringPoint", () => {
  it("places 0° at the right edge and -90° at the top", () => {
    expect(ringPoint(0)).toEqual({ left: "100%", top: "50%" });
    const top = ringPoint(-90);
    expect(parseFloat(top.left)).toBeCloseTo(50);
    expect(parseFloat(top.top)).toBeCloseTo(0);
  });
});

describe("paceOf", () => {
  it("is a hit once the goal is reached", () => {
    expect(paceOf(5, 5, 2)).toBe("hit");
    expect(paceOf(7, 5, 6)).toBe("hit");
  });

  it("is on pace when keeping up with the share of the week gone", () => {
    // Five days in, a goal of 7 expects 5.
    expect(paceOf(5, 7, 5)).toBe("on");
    expect(paceOf(4, 7, 5)).toBe("behind");
  });
});

describe("matchVerdict", () => {
  it("bands scores into strong, good and weak", () => {
    expect(matchVerdict(78)).toBe("strong");
    expect(matchVerdict(75)).toBe("strong");
    expect(matchVerdict(59)).toBe("good");
    expect(matchVerdict(39)).toBe("weak");
  });
});

describe("pledgeStats", () => {
  it("spreads the goal over five weekdays and totals twelve weeks", () => {
    expect(pledgeStats(5)).toMatchObject({ goal: 5, perDay: 1, total: 60, weeks: 12 });
    expect(pledgeStats(8)).toMatchObject({ perDay: 2, total: 96 });
    expect(pledgeStats(3)).toMatchObject({ perDay: 1, total: 36 });
  });

  it("clamps the goal to the slider's range", () => {
    expect(pledgeStats(0).goal).toBe(PLEDGE_MIN);
    expect(pledgeStats(40).goal).toBe(PLEDGE_MAX);
  });

  it("grows the chart's bars with the goal", () => {
    expect(pledgeStats(PLEDGE_MAX).barPct).toBe(90);
    expect(pledgeStats(PLEDGE_MIN).barPct).toBeLessThan(pledgeStats(10).barPct);
  });
});
