import { describe, expect, it } from "vitest";

import {
  EMPTY_SIGNUP,
  SIGNUP_STEPS,
  firstStepWithError,
  passwordHint,
  passwordMeter,
  passwordsMatch,
  stepErrors,
  validateSignup,
} from "./signupModel";

const valid = {
  displayName: "Amara Ellis",
  email: "amara@example.com",
  password: "correct horse battery staple",
  confirmPassword: "correct horse battery staple",
  workspaceName: "Amara's search",
};

describe("validateSignup", () => {
  it("accepts a complete form", () => {
    expect(validateSignup(valid)).toEqual({});
  });

  it("reports every problem with the page's messages", () => {
    expect(validateSignup({ ...EMPTY_SIGNUP, password: "short", confirmPassword: "other" })).toEqual({
      displayName: "Enter your name.",
      email: "Enter a valid email address.",
      password: "Use at least 12 characters.",
      confirmPassword: "Passwords do not match.",
      workspaceName: "Enter a workspace name.",
    });
  });

  it("treats a half-typed email as invalid", () => {
    expect(validateSignup({ ...valid, email: "amara@" }).email).toBe("Enter a valid email address.");
  });
});

describe("stepErrors", () => {
  it("only reports the current step's fields", () => {
    const fields = { ...EMPTY_SIGNUP, displayName: "Amara" };
    expect(stepErrors(0, fields)).toEqual({ email: "Enter a valid email address." });
    expect(Object.keys(stepErrors(1, fields))).toEqual(["password"]);
    expect(stepErrors(2, fields)).toEqual({ workspaceName: "Enter a workspace name." });
  });
});

describe("firstStepWithError", () => {
  it("finds the earliest step that needs attention", () => {
    expect(firstStepWithError({ workspaceName: "x", email: "y" })).toBe(0);
    expect(firstStepWithError({ confirmPassword: "x" })).toBe(1);
    expect(firstStepWithError({})).toBe(-1);
  });

  it("covers every field exactly once across the steps", () => {
    const owned = SIGNUP_STEPS.flatMap((step) => step.fields);
    expect(new Set(owned).size).toBe(owned.length);
    expect(owned.sort()).toEqual(Object.keys(EMPTY_SIGNUP).sort());
  });
});

describe("password hints", () => {
  it("fills three segments on the way to 12 and the fourth by 16", () => {
    expect(passwordMeter(0)).toEqual([0, 0, 0, 0]);
    expect(passwordMeter(6)).toEqual([1, 0.5, 0, 0]);
    expect(passwordMeter(12)).toEqual([1, 1, 1, 0]);
    expect(passwordMeter(14)).toEqual([1, 1, 1, 0.5]);
    expect(passwordMeter(30)).toEqual([1, 1, 1, 1]);
  });

  it("counts down to the minimum, then encourages length", () => {
    expect(passwordHint(0)).toBe("At least 12 characters.");
    expect(passwordHint(11)).toBe("1 more character.");
    expect(passwordHint(9)).toBe("3 more characters.");
    expect(passwordHint(12)).toBe("Long enough. Longer is stronger.");
    expect(passwordHint(16)).toBe("Nice and long.");
  });

  it("only matches a non-empty confirmation", () => {
    expect(passwordsMatch("", "")).toBe(false);
    expect(passwordsMatch("abc", "abc")).toBe(true);
    expect(passwordsMatch("abc", "abd")).toBe(false);
  });
});
