import { FormEvent, useId, useState } from "react";

import type { LoginCredentials } from "./authApi";

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
    <main className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0c1120] px-5 py-12 text-slate-200">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-28 top-0 h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-36 right-0 h-96 w-96 rounded-full bg-cyan-500/[0.06] blur-3xl"
      />
      <section className="relative w-full max-w-md rounded-2xl border border-white/[0.09] bg-[#111827]/95 p-7 shadow-2xl shadow-black/30 sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-lg shadow-indigo-600/20">
            AT
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight text-white">
              ApplyTogether
            </p>
            <p className="text-xs text-slate-500">Shared job-search workspace</p>
          </div>
        </div>

        <div className="mb-7">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Continue to your shared applications workspace.
          </p>
        </div>

        {error ? (
          <div
            id={errorId}
            role="alert"
            aria-live="polite"
            className="mb-5 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-200"
          >
            {error}
          </div>
        ) : null}

        <form className="space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-200">
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={error ? errorId : undefined}
              className="mt-2 w-full rounded-lg border border-white/10 bg-[#0c1120] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
              placeholder="you@example.com"
            />
          </label>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor={passwordId}>
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
                className="w-full rounded-lg border border-white/10 bg-[#0c1120] py-2.5 pl-3 pr-14 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
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
            className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
