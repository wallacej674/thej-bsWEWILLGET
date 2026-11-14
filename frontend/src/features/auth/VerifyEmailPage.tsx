import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import type { MessageResponse, VerificationResponse } from "./authApi";
import { AuthLayout } from "./AuthLayout";
import {
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPrimaryButtonClass,
} from "./authStyles";
import { useUrlToken } from "./useUrlToken";

interface VerifyEmailPageProps {
  onVerify(token: string): Promise<VerificationResponse>;
  onResend(email: string): Promise<MessageResponse>;
}

type VerificationState = "loading" | "verified" | "invalid";

export function VerifyEmailPage({
  onVerify,
  onResend,
}: VerifyEmailPageProps) {
  // Read once, then dropped from the address bar (SEC-20).
  const token = useUrlToken();
  const [state, setState] = useState<VerificationState>(
    token ? "loading" : "invalid",
  );
  const [email, setEmail] = useState("");
  const [resendPending, setResendPending] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendFailed, setResendFailed] = useState(false);
  const attemptedToken = useRef<string>();

  useEffect(() => {
    if (!token || attemptedToken.current === token) return;
    attemptedToken.current = token;
    void onVerify(token)
      .then(() => setState("verified"))
      .catch(() => setState("invalid"));
  }, [onVerify, token]);

  const resend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || resendPending) return;
    setResendPending(true);
    setResendFailed(false);
    setResendSent(false);
    try {
      await onResend(email.trim());
      setResendSent(true);
    } catch {
      setResendFailed(true);
    } finally {
      setResendPending(false);
    }
  };

  if (state === "loading") {
    return (
      <AuthLayout
        live
        title="Verifying your email"
        description="This only takes a moment."
      >
        <div aria-busy="true" className="space-y-3">
          <div className="h-12 w-full animate-pulse rounded-xl bg-foreground/[0.05]" />
          <div className="h-12 w-full animate-pulse rounded-xl bg-foreground/[0.07]" />
        </div>
      </AuthLayout>
    );
  }

  if (state === "verified") {
    return (
      <AuthLayout
        live
        title="Email verified"
        description="Your account is ready. Sign in with the password you created."
      >
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.08] px-4 py-3 text-sm text-primary">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/15 text-primary"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <path
                d="m5 12.5 4.25 4.25L19 7"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Verification complete
        </div>
        <Link to="/login?verified=true" className={authPrimaryButtonClass}>
          Sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      live
      title="Get a new link"
      description="This verification link is missing, invalid, or expired. Enter your email and we will send another if a registration is pending."
      footer={
        <Link to="/login" className={authLinkClass}>
          Return to sign in
        </Link>
      }
    >
      <form onSubmit={resend}>
        <label className={authLabelClass}>
          Email address
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className={`${authInputClass} mt-2 font-normal`}
          />
        </label>
        <button
          type="submit"
          disabled={resendPending}
          className={`${authPrimaryButtonClass} mt-4`}
        >
          {resendPending ? "Sending new link…" : "Send a new link"}
        </button>
        {resendSent ? (
          <p role="status" className="mt-4 text-sm leading-6 text-primary">
            If a registration is pending, a new link is on its way.
          </p>
        ) : null}
        {resendFailed ? (
          <p role="alert" className="mt-4 text-sm leading-6 text-destructive">
            The link could not be sent. Check the connection and try again.
          </p>
        ) : null}
      </form>
    </AuthLayout>
  );
}
