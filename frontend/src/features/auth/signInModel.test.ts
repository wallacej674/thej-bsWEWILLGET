import { describe, expect, it } from "vitest";

import { coachingLine, looksLikeEmail, ringTone, signInProgress } from "./signInModel";

describe("looksLikeEmail", () => {
  it("accepts addresses shaped like an email, ignoring surrounding spaces", () => {
    expect(looksLikeEmail("maya@example.test")).toBe(true);
    expect(looksLikeEmail("  maya@example.test ")).toBe(true);
  });

  it("rejects partial addresses", () => {
    for (const value of ["", "maya", "maya@", "maya@example", "@example.test", "ma ya@example.test"]) {
      expect(looksLikeEmail(value)).toBe(false);
    }
  });
});

describe("signInProgress", () => {
  it("is half for a likely email and half for any password", () => {
    expect(signInProgress("", "")).toBe(0);
    expect(signInProgress("maya@example.test", "")).toBe(0.5);
    expect(signInProgress("maya", "secret")).toBe(0.5);
    expect(signInProgress("maya@example.test", "secret")).toBe(1);
  });
});

describe("ringTone", () => {
  it("turns green once accepted", () => {
    expect(ringTone("accepted", "")).toBe("success");
  });

  it("turns red after a rejection until a new password is typed", () => {
    expect(ringTone("error", "")).toBe("destructive");
    expect(ringTone("error", "x")).toBe("primary");
    expect(ringTone("idle", "")).toBe("primary");
  });
});

describe("coachingLine", () => {
  it("walks through email, then password, then ready", () => {
    expect(coachingLine("idle", "", "")).toBe("Start with your email.");
    expect(coachingLine("idle", "maya@example.test", "")).toBe("Now your password.");
    expect(coachingLine("idle", "maya@example.test", "secret")).toBe("Ready when you are.");
  });

  it("describes checking, acceptance and a rejection", () => {
    expect(coachingLine("pending", "maya@example.test", "secret")).toBe("Checking your details…");
    expect(coachingLine("accepted", "maya@example.test", "")).toBe("You're in. Opening your week…");
    expect(coachingLine("error", "maya@example.test", "")).toBe("That didn't match. Try again.");
    expect(coachingLine("error", "maya@example.test", "again")).toBe("Ready when you are.");
  });
});
