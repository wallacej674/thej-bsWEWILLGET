import { FormEvent, useId, useState } from "react";
import { Link, useSearchParams } from "react-router";

import type { LoginCredentials } from "./authApi";
import { AuthLayout } from "./AuthLayout";

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
    <AuthLayout eyebrow="Welcome back">
      <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white">
        Sign in
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Continue to your shared applications workspace.
      </p>

      {searchParams.get("verified") === "true" ? (
        <div
          role="status"
          className="mt-6 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.08] px-3.5 py-3 text-sm text-emerald-200"
        >
          Email verified. Sign in to continue.
        </div>
      ) : null}

      {error ? (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          className="mt-6 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3.5 py-3 text-sm text-rose-200"
        >
          {error}
        </div>
      ) : null}

      <form className="mt-8 space-y-5" onSubmit={submit}>
        <label className="block text-sm font-medium text-slate-200">
          Email address
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-describedby={error ? errorId : undefined}
            className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-[#151e2f] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
            placeholder="you@example.com"
          />
        </label>

        <div>
          <label
            className="block text-sm font-medium text-slate-200"
            htmlFor={passwordId}
          >
            Password
          </label>
          <div className="relative mt-2">
            <input
              id={passwordId}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={error ? errorId : undefined}
              className="min-h-11 w-full rounded-lg border border-white/10 bg-[#151e2f] py-2.5 pl-3.5 pr-14 text-sm text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1120] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-500">
        New to ApplyTogether?{" "}
        <Link
          to="/signup"
          className="font-semibold text-indigo-300 transition hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
