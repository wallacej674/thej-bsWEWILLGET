import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import type { MessageResponse, VerificationResponse } from "./authApi";
import { AuthLayout } from "./AuthLayout";

interface VerifyEmailPageProps {
  onVerify(token: string): Promise<VerificationResponse>;
  onResend(email: string): Promise<MessageResponse>;
}

type VerificationState = "loading" | "verified" | "invalid";

export function VerifyEmailPage({
  onVerify,
  onResend,
}: VerifyEmailPageProps) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
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
      <AuthLayout eyebrow="Email verification">
        <div aria-live="polite" aria-busy="true">
          <div className="h-9 w-52 animate-pulse rounded bg-white/[0.07]" />
          <div className="mt-4 h-4 w-full max-w-sm animate-pulse rounded bg-white/[0.05]" />
          <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-white/[0.05]" />
        </div>
      </AuthLayout>
    );
  }

  if (state === "verified") {
    return (
      <AuthLayout eyebrow="Email verification">
        <div aria-live="polite">
          <span
            aria-hidden="true"
            className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path
                d="m5 12.5 4.25 4.25L19 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white">
            Email verified
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
            Your account is ready. Sign in with the password you created.
          </p>
          <Link
            to="/login?verified=true"
            className="mt-7 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            Sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="Email verification">
      <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white">
        Get a new link
      </h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
        This verification link is missing, invalid, or expired. Enter your email
        and we will send another if a registration is pending.
      </p>
      <form className="mt-7" onSubmit={resend}>
        <label className="block text-sm font-medium text-slate-200">
          Email address
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-[#151e2f] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
          />
        </label>
        <button
          type="submit"
          disabled={resendPending}
          className="mt-5 min-h-11 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-60"
        >
          {resendPending ? "Sending new link…" : "Send a new link"}
        </button>
        {resendSent ? (
          <p role="status" className="mt-4 text-sm leading-6 text-emerald-300">
            If a registration is pending, a new link is on its way.
          </p>
        ) : null}
        {resendFailed ? (
          <p role="alert" className="mt-4 text-sm leading-6 text-rose-300">
            The link could not be sent. Check the connection and try again.
          </p>
        ) : null}
      </form>
      <Link
        to="/login"
        className="mt-6 inline-flex text-sm font-medium text-slate-400 transition hover:text-white"
      >
        Return to sign in
      </Link>
    </AuthLayout>
  );
}
