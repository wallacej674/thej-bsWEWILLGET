import { describe, expect, it } from "vitest";

import type { ResumeTailorResult } from "../applications/types";
import { hasJobDescription, matchVerdict, tailorSections } from "./tailorModel";

const result: ResumeTailorResult = {
  match_score: 70,
  matched_keywords: ["Python"],
  missing_keywords: ["dbt"],
  suggested_summary: "Analyst who ships.",
  suggested_bullets: ["Built dashboards.", "Ran experiments."],
  interview_talking_points: ["An experiment you ran."],
  caution_notes: [],
  ats_warnings: ["Use one column."],
};

describe("matchVerdict", () => {
  it("grades the score", () => {
    expect(matchVerdict(80).label).toBe("Strong match");
    expect(matchVerdict(75).label).toBe("Strong match");
    expect(matchVerdict(60).label).toBe("Good match");
    expect(matchVerdict(30).label).toBe("Weak match");
  });
});

describe("tailorSections", () => {
  it("orders the sections and leaves out empty ones", () => {
    const sections = tailorSections(result);

    expect(sections.map((section) => section.key)).toEqual(["summary", "bullets", "interview", "ats"]);
    expect(sections[1].copy).toBe("Built dashboards.\nRan experiments.");
    expect(sections[3].tone).toBe("warning");
  });
});

describe("hasJobDescription", () => {
  it("ignores blank descriptions", () => {
    expect(hasJobDescription({ job_description: "  " })).toBe(false);
    expect(hasJobDescription({ job_description: null })).toBe(false);
    expect(hasJobDescription({ job_description: "Build APIs" })).toBe(true);
  });
});
