// Pure rules behind the three-step sign-up page: which fields each step owns,
// how they're validated, and the hints the password step shows.
import { looksLikeEmail } from "./signInModel";

export type SignupFieldName =
  | "displayName"
  | "email"
  | "password"
  | "confirmPassword"
  | "workspaceName";
export type SignupFields = Record<SignupFieldName, string>;
export type SignupErrors = Partial<Record<SignupFieldName, string>>;

/** Matches the server's minimum (backend/app/core/passwords.py). */
export const MIN_PASSWORD_LENGTH = 12;
/** Length at which the meter's last segment fills. */
export const STRONG_PASSWORD_LENGTH = 16;

export const EMPTY_SIGNUP: SignupFields = {
  displayName: "",
  email: "",
  password: "",
  confirmPassword: "",
  workspaceName: "",
};

export interface SignupStep {
  label: string;
  title: string;
  description: string;
  fields: SignupFieldName[];
}

export const SIGNUP_STEPS: SignupStep[] = [
  {
    label: "You",
    title: "Let's start with you",
    description: "Your name is how your crew will see you.",
    fields: ["displayName", "email"],
  },
  {
    label: "Password",
    title: "Lock it down",
    description: `Use ${MIN_PASSWORD_LENGTH} characters or more.`,
    fields: ["password", "confirmPassword"],
  },
  {
    label: "Workspace",
    title: "Name your crew's space",
    description: "Where your crew's applications will live.",
    fields: ["workspaceName"],
  },
];

/** The stepper's stages: the three form steps, then checking your email. */
export const SIGNUP_STAGES = [...SIGNUP_STEPS.map((step) => step.label), "Verify"];

export function validateSignup(fields: SignupFields): SignupErrors {
  const errors: SignupErrors = {};
  if (!fields.displayName.trim()) errors.displayName = "Enter your name.";
  if (!looksLikeEmail(fields.email)) errors.email = "Enter a valid email address.";
  if (fields.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (fields.confirmPassword !== fields.password) {
    errors.confirmPassword = "Passwords do not match.";
  }
  if (!fields.workspaceName.trim()) errors.workspaceName = "Enter a workspace name.";
  return errors;
}

/** Only the errors for one step's fields. */
export function stepErrors(step: number, fields: SignupFields): SignupErrors {
  const all = validateSignup(fields);
  const owned = SIGNUP_STEPS[step]?.fields ?? [];
  return Object.fromEntries(
    owned.filter((name) => all[name]).map((name) => [name, all[name]]),
  ) as SignupErrors;
}

/** The first step holding an error, or -1 when there are none. */
export function firstStepWithError(errors: SignupErrors): number {
  return SIGNUP_STEPS.findIndex((step) => step.fields.some((name) => errors[name]));
}

export function passwordLongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return confirmPassword.length > 0 && confirmPassword === password;
}

/**
 * How full each of the meter's four segments is, 0..1. The first three
 * fill on the way to the minimum; the fourth rewards extra length.
 */
export function passwordMeter(length: number): number[] {
  const perSegment = MIN_PASSWORD_LENGTH / 3;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return [
    clamp(length / perSegment),
    clamp((length - perSegment) / perSegment),
    clamp((length - perSegment * 2) / perSegment),
    clamp((length - MIN_PASSWORD_LENGTH) / (STRONG_PASSWORD_LENGTH - MIN_PASSWORD_LENGTH)),
  ];
}

export function passwordHint(length: number): string {
  if (length === 0) return `At least ${MIN_PASSWORD_LENGTH} characters.`;
  const short = MIN_PASSWORD_LENGTH - length;
  if (short > 0) return `${short} more character${short === 1 ? "" : "s"}.`;
  if (length >= STRONG_PASSWORD_LENGTH) return "Nice and long.";
  return "Long enough. Longer is stronger.";
}
