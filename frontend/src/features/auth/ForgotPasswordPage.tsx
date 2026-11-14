// "Forgot your password?": ask for a reset link. The answer is the same
// whether or not the email has an account (SEC-10).
import { type FormEvent, useId, useState } from "react";
import { Link, useLocation } from "react-router";
import { Mail } from "lucide-react";
import { motion } from "motion/react";

import type { MessageResponse } from "./authApi";
import { AuthShell } from "./AuthShell";
import { authLinkClass, authPrimaryButtonClass } from "./authStyles";
import { FloatingField } from "./FloatingField";
import { looksLikeEmail } from "./signInModel";

interface ForgotPasswordPageProps {
  onRequestReset(email: string): Promise<MessageResponse>;
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "rate_limited" && error instanceof Error) return error.message;
    if (error.code === "network_error") {
      return "ApplyTogether is unavailable. Check the connection and try again.";
    }
  }
  return "That didn't work. Check the email address and try again.";
}

export function ForgotPasswordPage({ onRequestReset }: ForgotPasswordPageProps) {
  const location = useLocation();
  const emailId = useId();
  const errorId = useId();
  // The sign-in page passes along what was typed there.
  const typed = (location.state as { email?: string } | null)?.email ?? "";
  const [email, setEmail] = useState(typed);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string>();
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    if (!looksLikeEmail(email)) {
      setError("Enter the email address you sign in with.");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await onRequestReset(email.trim());
      setSentTo(email.trim());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  const backToSignIn = (
    <Link to="/login" className={authLinkClass}>
      Back to sign in
    </Link>
  );

  if (sentTo) {
    return (
      <AuthShell
        title="Check your email"
        description="If an account uses that address, a link to choose a new password is on its way."
        footer={backToSignIn}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <motion.span
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
            initial={{ y: -24, opacity: 0, rotate: -12 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
          >
            <Mail size={26} />
          </motion.span>
          <p className="break-all text-[0.95rem] font-medium text-foreground">{sentTo}</p>
          <p className="text-sm text-muted-foreground">
            The link works once, for 30 minutes. Nothing arrived? Check spam, or ask again in a
            few minutes.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter the email you sign in with and we'll send you a link to choose a new one."
      footer={backToSignIn}
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
      <form onSubmit={submit} noValidate className="space-y-5">
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
        <button type="submit" disabled={pending} className={authPrimaryButtonClass}>
          {pending ? "Sending link…" : "Send reset link"}
        </button>
      </form>
    </AuthShell>
  );
}
