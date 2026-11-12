import { FormEvent, useId, useState } from "react";
import { Link, useSearchParams } from "react-router";

import type { LoginCredentials } from "./authApi";
import { AuthLayout } from "./AuthLayout";
import {
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPrimaryButtonClass,
} from "./authStyles";

interface LoginPageProps {
  onLogin(credentials: LoginCredentials): Promise<void>;
}

function loginErrorMessage(error: unknown): string {
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

export function LoginPage({ onLogin }: LoginPageProps) {
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(undefined);
    try {
      await onLogin({ email, password });
    } catch (caught) {
      setError(loginErrorMessage(caught));
    } finally {
      setPassword("");
      setPending(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in to ApplyTogether"
      description="Pick up where your team left off."
      footer={
        <>
          New to ApplyTogether?{" "}
          <Link to="/signup" className={authLinkClass}>
            Create an account
          </Link>
        </>
      }
    >
      {searchParams.get("verified") === "true" ? (
        <div
          role="status"
          className="mb-5 rounded-xl border border-primary/25 bg-primary/[0.08] px-4 py-3 text-sm text-primary"
        >
          Email verified. Sign in to continue.
        </div>
      ) : null}

      {error ? (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={submit}>
        <label htmlFor={emailId} className={authLabelClass}>
          Email address
        </label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={error ? errorId : undefined}
          placeholder="you@example.com"
          className={`${authInputClass} mb-5`}
        />

        <label htmlFor={passwordId} className={authLabelClass}>
          Password
        </label>
        <div className="relative mb-6">
          <input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={error ? errorId : undefined}
            placeholder="Enter your password"
            className={`${authInputClass} pr-16`}
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-1 text-[0.8rem] font-semibold text-primary transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        <button
          type="submit"
          disabled={pending}
          className={authPrimaryButtonClass}
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
