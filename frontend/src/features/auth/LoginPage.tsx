import { FormEvent, useId, useState } from "react";
import { Link, useSearchParams } from "react-router";

import type { LoginCredentials } from "./authApi";
import logoUrl from "../../assets/applytogether-logo.png";

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

const PANEL_BACKGROUND =
  "radial-gradient(120% 90% at 18% 6%, rgba(214,168,68,0.20), transparent 52%)," +
  " linear-gradient(160deg, #221809 0%, #1a130b 60%)";

const WORKSPACE = [
  { company: "Lakefront Health", role: "Product operations", status: "Applied", active: true },
  { company: "Copperline Studio", role: "UX researcher", status: "Reviewing", active: false },
  { company: "Northstar Civic Lab", role: "Program manager", status: "Saved", active: false },
];

const inputClass =
  "h-[3.125rem] w-full rounded-xl border border-border bg-input px-4 text-[0.95rem] text-foreground outline-none transition placeholder:text-[#6b6253] focus:border-primary/60 focus:ring-2 focus:ring-primary/15";

const labelClass = "mb-2 block text-[0.8rem] font-semibold text-[#cfc4af]";

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
    <main className="dark theme-gold flex min-h-[100dvh] bg-background text-foreground [font-family:'Space_Grotesk',system-ui,sans-serif]">
      <section className="hidden flex-1 p-[1.6rem] lg:flex">
        <div
          className="relative flex flex-1 flex-col overflow-hidden rounded-3xl border border-primary/10 p-[clamp(2rem,3vw,3.5rem)]"
          style={{ background: PANEL_BACKGROUND }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-20 -top-14 select-none font-bold leading-none text-primary/[0.05] [font-size:26rem]"
          >
            AT
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-[12%] -top-[20%] h-[160%] w-3/5 -rotate-[22deg] bg-[linear-gradient(90deg,transparent,rgba(224,184,80,0.12),transparent)]"
          />

          <p className="relative flex-none text-[1.25rem] tracking-[-0.01em] text-foreground">
            Apply<span className="font-bold">Together</span>
          </p>

          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center py-7">
            <div className="w-full max-w-[38rem]">
              <p className="mb-[1.1rem] text-[0.7rem] font-bold tracking-[0.16em] text-primary">
                SHARED JOB-SEARCH WORKSPACE
              </p>
              <h2 className="mb-5 text-[2.5rem] font-bold leading-[1.08] tracking-[-0.02em] text-[#f6f0e4]">
                Keep the search shared. Keep every application accountable.
              </h2>
              <p className="mb-8 max-w-[30rem] text-base leading-[1.62] text-[#a89a80]">
                Build one clear workspace for the roles you are pursuing, the
                people helping, and the next action on every application.
              </p>

              <div className="rounded-2xl border border-primary/[0.18] bg-white/[0.035] p-5">
                <p className="mb-4 text-[0.7rem] font-bold tracking-[0.14em] text-[#9a8b6c]">
                  SHARED WORKSPACE
                </p>
                <div className="flex flex-col gap-3.5">
                  {WORKSPACE.map((item, index) => (
                    <div key={item.company}>
                      {index > 0 ? (
                        <div className="mb-3.5 h-px bg-primary/[0.12]" />
                      ) : null}
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[0.9rem] font-bold text-[#f2ece0]">
                            {item.company}
                          </p>
                          <p className="text-[0.75rem] text-[#9a8b6c]">
                            {item.role}
                          </p>
                        </div>
                        {item.active ? (
                          <span className="flex flex-none items-center gap-1.5 text-[0.625rem] font-bold tracking-[0.1em] text-[#e0b850]">
                            <span className="h-[0.44rem] w-[0.44rem] rounded-full bg-primary" />
                            {item.status.toUpperCase()}
                          </span>
                        ) : (
                          <span className="flex-none text-[0.625rem] font-bold tracking-[0.1em] text-[#8c8068]">
                            {item.status.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex w-full items-center justify-center px-6 py-10 sm:px-10 lg:w-auto lg:flex-none lg:basis-[clamp(27rem,32%,42rem)] lg:px-14">
        <div className="w-full max-w-[25rem]">
          <div className="mb-11 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[0.7rem] bg-[#060504] p-0.5">
              <img
                src={logoUrl}
                alt=""
                className="h-full w-full object-contain"
              />
            </span>
            <p className="text-[1.375rem] tracking-[-0.01em] text-foreground">
              Apply<span className="font-bold">Together</span>
            </p>
          </div>

          <p className="mb-3 text-[0.7rem] font-bold tracking-[0.16em] text-primary">
            WELCOME BACK
          </p>
          <h1 className="mb-2 text-[2.5rem] font-bold tracking-[-0.02em] text-foreground">
            Sign in
          </h1>
          <p className="mb-8 text-[0.95rem] text-muted-foreground">
            Continue to your shared applications workspace.
          </p>

          {searchParams.get("verified") === "true" ? (
            <div
              role="status"
              className="mb-6 rounded-xl border border-primary/25 bg-primary/[0.08] px-4 py-3 text-sm text-[#e7cf99]"
            >
              Email verified. Sign in to continue.
            </div>
          ) : null}

          {error ? (
            <div
              id={errorId}
              role="alert"
              aria-live="polite"
              className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-[#f0a9a3]"
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={submit}>
            <label htmlFor={emailId} className={labelClass}>
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
              className={`${inputClass} mb-5`}
            />

            <label htmlFor={passwordId} className={labelClass}>
              Password
            </label>
            <div className="relative mb-7">
              <input
                id={passwordId}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby={error ? errorId : undefined}
                placeholder="Enter your password"
                className={`${inputClass} pr-[4.25rem]`}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[0.85rem] font-semibold text-primary transition hover:text-[#e8c976] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="h-[3.25rem] w-full rounded-xl border border-primary/35 bg-secondary text-[0.95rem] font-semibold text-foreground transition hover:border-primary/60 hover:bg-[#3a2a17] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-[0.875rem] text-muted-foreground">
            New to ApplyTogether?{" "}
            <Link
              to="/signup"
              className="font-bold text-primary transition hover:text-[#e8c976] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
