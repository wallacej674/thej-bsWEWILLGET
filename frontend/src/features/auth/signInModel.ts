// Pure rules behind the sign-in page's goal ring and coaching line.

// "throttled": the server asked this browser to wait before trying again.
export type SignInPhase = "idle" | "pending" | "accepted" | "error" | "throttled";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A light check that an address is shaped like an email. The server decides. */
export function looksLikeEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** How full the ring is, 0..1: half for a likely email, half for a password. */
export function signInProgress(email: string, password: string): number {
  return (looksLikeEmail(email) ? 0.5 : 0) + (password ? 0.5 : 0);
}

export type RingTone = "primary" | "success" | "destructive";

/** Red right after a rejected attempt, until a new password is typed. */
export function ringTone(phase: SignInPhase, password: string): RingTone {
  if (phase === "accepted") return "success";
  if ((phase === "error" || phase === "throttled") && !password) return "destructive";
  return "primary";
}

/** The short line under the heading that coaches each step. */
export function coachingLine(phase: SignInPhase, email: string, password: string): string {
  if (phase === "pending") return "Checking your details…";
  if (phase === "accepted") return "You're in. Opening your week…";
  if (phase === "error" && !password) return "That didn't match. Try again.";
  if (phase === "throttled" && !password) return "Too many tries. Take a short break.";
  if (!looksLikeEmail(email)) return "Start with your email.";
  if (!password) return "Now your password.";
  return "Ready when you are.";
}
