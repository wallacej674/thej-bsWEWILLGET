import type { ReactNode } from "react";

export function AuthLayout({
  children,
  eyebrow,
}: {
  children: ReactNode;
  eyebrow: string;
}) {
  return (
    <main className="dark min-h-[100dvh] bg-[#0c1120] text-slate-200 [font-family:Outfit,system-ui,sans-serif]">
      <div className="mx-auto grid min-h-[100dvh] max-w-[1400px] grid-cols-1 md:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <section className="flex items-center px-5 py-10 sm:px-10 md:px-14 lg:px-20">
          <div className="w-full max-w-[520px] motion-safe:animate-[auth-enter_480ms_cubic-bezier(0.16,1,0.3,1)_both]">
            <div className="mb-10 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-400/25 bg-indigo-500/15 text-sm font-bold tracking-tight text-indigo-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                AT
              </span>
              <div>
                <p className="text-base font-semibold tracking-tight text-white">
                  ApplyTogether
                </p>
                <p className="text-xs text-slate-500">Shared job-search workspace</p>
              </div>
            </div>
            <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-indigo-300">
              {eyebrow}
            </p>
            {children}
          </div>
        </section>

        <aside className="relative hidden overflow-hidden border-l border-white/[0.07] bg-[#101727] p-12 md:flex md:flex-col md:justify-between lg:p-16">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-indigo-400/40" />
          <div>
            <p className="max-w-sm text-3xl font-semibold leading-tight tracking-[-0.03em] text-white">
              Keep the search shared. Keep every application accountable.
            </p>
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-400">
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
                    ? "border-indigo-400 bg-indigo-400/[0.06]"
                    : "border-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{company}</p>
                    <p className="mt-1 text-xs text-slate-500">{role}</p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
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
