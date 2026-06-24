import type { ReactNode } from "react";

import logoUrl from "../../assets/applytogether-logo.png";

export function AuthLayout({
  children,
  eyebrow,
}: {
  children: ReactNode;
  eyebrow: string;
}) {
  return (
    <main className="dark theme-gold min-h-[100dvh] bg-background text-foreground [font-family:'Space_Grotesk',system-ui,sans-serif]">
      <div className="mx-auto grid min-h-[100dvh] max-w-[1400px] grid-cols-1 md:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <section className="flex items-center px-5 py-10 sm:px-10 md:px-14 lg:px-20">
          <div className="w-full max-w-[520px] motion-safe:animate-[auth-enter_480ms_cubic-bezier(0.16,1,0.3,1)_both]">
            <div className="mb-10 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-[#060504] p-0.5">
                <img
                  src={logoUrl}
                  alt=""
                  className="h-full w-full object-contain"
                />
              </span>
              <div>
                <p className="text-base font-semibold tracking-tight text-foreground">
                  ApplyTogether
                </p>
                <p className="text-xs text-muted-foreground">Shared job-search workspace</p>
              </div>
            </div>
            <p className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-primary">
              {eyebrow}
            </p>
            {children}
          </div>
        </section>

        <aside className="relative hidden overflow-hidden border-l border-border bg-card p-12 md:flex md:flex-col md:justify-between lg:p-16">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-primary/40" />
          <div>
            <p className="max-w-sm text-3xl font-semibold leading-tight tracking-[-0.03em] text-foreground">
              Keep the search shared. Keep every application accountable.
            </p>
            <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">
              Build one clear workspace for the roles you are pursuing, the people
              helping, and the next action on every application.
            </p>
          </div>

          <div className="space-y-3" aria-hidden="true">
            {[
              ["Lakefront Health", "Product operations", "Applied"],
              ["Copperline Studio", "UX researcher", "Reviewing"],
              ["Northstar Civic Lab", "Program manager", "Saved"],
            ].map(([company, role, status], index) => (
              <div
                key={company}
                className={`border-l px-4 py-3 ${
                  index === 0
                    ? "border-primary bg-primary/[0.06]"
                    : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{company}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{role}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
