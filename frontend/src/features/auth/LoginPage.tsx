// Sign in, as a goal ring: the logo sits in a ring that fills as the form is
// completed, a line under the heading coaches each step, the ring spins while
// the details are checked and closes green when they're accepted. A wrong
// password shakes the form. Company-wall cards drift past on wide screens.
import { type FormEvent, useId, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { LoaderCircle } from "lucide-react";
import { AnimatePresence, MotionConfig, motion, useAnimate, useReducedMotion } from "motion/react";

import { ThemeToggle } from "../../app/theme/ThemeToggle";
import { EASE_OUT } from "../dashboard/dashboardStyles";
import type { LoginCredentials } from "./authApi";
import { AuthGoalRing } from "./AuthGoalRing";
import type { LoginOptions } from "./AuthProvider";
import { authLinkClass } from "./authStyles";
import { FloatingField } from "./FloatingField";
import { type SignInPhase, coachingLine, looksLikeEmail, ringTone, signInProgress } from "./signInModel";
import { WallBackdrop } from "./WallBackdrop";

interface LoginPageProps {
  onLogin(credentials: LoginCredentials, options?: LoginOptions): Promise<void>;
}

// How long the closed ring shows before the app takes over.
const ACCEPTED_PAUSE_MS = 700;
const SHAKE = { x: [0, -10, 9, -7, 5, -2, 0] };

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

function loginErrorMessage(error: unknown): string {
  // The server says how long to wait, e.g. "Try again in 4 minutes."
  if (
    errorCode(error) === "login_throttled" &&
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "network_error"
  ) {
    return "ApplyTogether is unavailable. Check the connection and try again.";
  }

  return "Email or password is incorrect.";
}

function SubmitLabel({ phase }: { phase: SignInPhase }) {
  const key = phase === "error" ? "idle" : phase;
  return (
    <motion.span
      key={key}
      className="inline-flex items-center gap-2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {phase === "pending" ? (
        <>
          <LoaderCircle size={17} className="motion-safe:animate-spin" aria-hidden="true" /> Signing in…
        </>
      ) : phase === "accepted" ? (
        "Signed in"
      ) : (
        "Sign in"
      )}
    </motion.span>
  );
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  const [searchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const [column, animate] = useAnimate<HTMLDivElement>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<SignInPhase>("idle");
  const [error, setError] = useState<string>();

  const busy = phase === "pending" || phase === "accepted";
  const progress = signInProgress(email, password);
  const line = coachingLine(phase, email, password);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    setPhase("pending");
    setError(undefined);
    try {
      await onLogin(
        { email, password },
        {
          onAccepted: async () => {
            setPhase("accepted");
            if (reduceMotion) return;
            await new Promise((resolve) => window.setTimeout(resolve, ACCEPTED_PAUSE_MS));
          },
        },
      );
      setPhase("idle");
    } catch (caught) {
      setError(loginErrorMessage(caught));
      setPhase(errorCode(caught) === "login_throttled" ? "throttled" : "error");
      if (!reduceMotion && column.current) {
        void animate(column.current, SHAKE, { duration: 0.45, ease: "easeOut" });
      }
    } finally {
      setPassword("");
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground font-display">
        <WallBackdrop />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background:radial-gradient(40%_35%_at_50%_30%,color-mix(in_srgb,var(--primary)_10%,transparent),transparent_70%)]"
        />
        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>

        <div className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div ref={column} className="w-full max-w-[24rem]">
            <div className="flex flex-col items-center text-center">
              <AuthGoalRing
                progress={progress}
                tone={ringTone(phase, password)}
                spinning={phase === "pending"}
                done={phase === "accepted"}
              />
              <motion.h1
                className="mt-6 text-[1.9rem] font-bold leading-tight tracking-[-0.02em] text-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.2 }}
              >
                Welcome back
              </motion.h1>
              <div className="relative mt-1 h-6 w-full overflow-hidden" aria-live="polite">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.p
                    key={line}
                    className="absolute inset-x-0 text-[0.95rem] text-muted-foreground"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                  >
                    {line}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            <motion.div
              className="mt-8 rounded-2xl border border-border bg-card/90 p-6 shadow-[var(--shadow-raised)] ring-1 ring-inset ring-white/[0.03] backdrop-blur sm:p-7"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.3 }}
            >
              {searchParams.get("verified") === "true" ? (
                <div
                  role="status"
                  className="mb-5 rounded-xl border border-primary/25 bg-primary/[0.08] px-4 py-3 text-sm text-primary"
                >
                  Email verified. Sign in to continue.
                </div>
              ) : null}

              <AnimatePresence initial={false}>
                {error ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                    className="overflow-hidden"
                  >
                    <div
                      id={errorId}
                      role="alert"
                      aria-live="polite"
                      className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                    >
                      {error}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <form onSubmit={submit} className="space-y-4">
                <FloatingField
                  id={emailId}
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={setEmail}
                  done={looksLikeEmail(email)}
                  describedBy={error ? errorId : undefined}
                />
                <FloatingField
                  id={passwordId}
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={setPassword}
                  done={password.length > 0}
                  describedBy={error ? errorId : undefined}
                  trailing={
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="rounded-md px-1.5 py-1 text-[0.8rem] font-semibold text-primary transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  }
                />
                <motion.button
                  type="submit"
                  disabled={busy}
                  // A small nudge when the form is ready to send.
                  animate={{ scale: progress === 1 && phase !== "pending" ? [1, 1.03, 1] : 1 }}
                  transition={{ duration: 0.4 }}
                  className={`!mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl px-4 text-[0.95rem] font-semibold text-primary-foreground transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-progress ${
                    phase === "accepted"
                      ? "bg-[var(--success)]"
                      : progress === 1
                        ? "bg-primary shadow-[0_10px_28px_-10px_color-mix(in_srgb,var(--primary)_80%,transparent)] hover:bg-primary/90"
                        : "bg-primary/80 hover:bg-primary/90"
                  }`}
                >
                  <SubmitLabel phase={phase} />
                </motion.button>
              </form>
            </motion.div>

            <motion.p
              className="mt-6 text-center text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              New to ApplyTogether?{" "}
              <Link to="/signup" className={authLinkClass}>
                Create an account
              </Link>
            </motion.p>
          </div>
        </div>
      </main>
    </MotionConfig>
  );
}
