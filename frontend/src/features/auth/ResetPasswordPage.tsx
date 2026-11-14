// Choose a new password from an emailed link (SEC-10). The token is read
// once and removed from the address bar straight away (SEC-20).
import { type FormEvent, useId, useState } from "react";
import { Link } from "react-router";
import { Check } from "lucide-react";
import { motion } from "motion/react";

import type { ResetPasswordInput } from "./authApi";
import { AuthShell } from "./AuthShell";
import { authLinkClass, authPrimaryButtonClass } from "./authStyles";
import { FloatingField } from "./FloatingField";
import { MIN_PASSWORD_LENGTH, passwordLongEnough, passwordsMatch } from "./signupModel";
import { PasswordMeter, Requirement } from "./signupParts";
import { useUrlToken } from "./useUrlToken";

interface ResetPasswordPageProps {
  onReset(input: ResetPasswordInput): Promise<void>;
}

type Phase = "form" | "done" | "invalid";

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

export function ResetPasswordPage({ onReset }: ResetPasswordPageProps) {
  const token = useUrlToken();
  const passwordId = useId();
  const confirmId = useId();
  const errorId = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState<Phase>(token ? "form" : "invalid");
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    if (!passwordLongEnough(password)) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (!passwordsMatch(password, confirm)) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await onReset({ token, password });
      setPhase("done");
    } catch (caught) {
      const code = errorCode(caught);
      if (code === "reset_link_invalid") {
        setPhase("invalid");
      } else if (
        (code === "password_policy_failed" || code === "rate_limited") &&
        caught instanceof Error
      ) {
        setError(caught.message);
      } else {
        setError("That didn't work. Try again in a moment.");
      }
    } finally {
      setPending(false);
    }
  };

  if (phase === "invalid") {
    return (
      <AuthShell
        title="This link has expired"
        description="Reset links work once, for 30 minutes. Ask for a fresh one and use it straight away."
      >
        <Link
          to="/forgot-password"
          className={`${authPrimaryButtonClass} no-underline`}
        >
          Send a new link
        </Link>
      </AuthShell>
    );
  }

  if (phase === "done") {
    return (
      <AuthShell
        title="Password updated"
        description="You've been signed out everywhere. Sign in with your new password."
      >
        <div className="flex flex-col items-center gap-5">
          <motion.span
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success)] text-white"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
          >
            <Check size={28} strokeWidth={3} />
          </motion.span>
          <Link to="/login" className={`${authPrimaryButtonClass} no-underline`}>
            Sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      description={`Use ${MIN_PASSWORD_LENGTH} characters or more. Every device will be signed out.`}
      footer={
        <Link to="/login" className={authLinkClass}>
          Back to sign in
        </Link>
      }
    >
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <FloatingField
            id={passwordId}
            label="New password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            done={passwordLongEnough(password)}
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
          <PasswordMeter password={password} />
        </div>
        <FloatingField
          id={confirmId}
          label="Confirm new password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          done={passwordsMatch(password, confirm)}
        />
        <ul className="space-y-2 rounded-xl bg-secondary/50 p-3.5" aria-label="Password checks">
          <Requirement met={passwordLongEnough(password)}>
            {`${MIN_PASSWORD_LENGTH} characters or more`}
          </Requirement>
          <Requirement met={passwordsMatch(password, confirm)}>Both passwords match</Requirement>
        </ul>
        <button type="submit" disabled={pending} className={`${authPrimaryButtonClass} !mt-6`}>
          {pending ? "Saving…" : "Save new password"}
        </button>
      </form>
    </AuthShell>
  );
}
