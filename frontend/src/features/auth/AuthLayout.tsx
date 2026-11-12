import type { ReactNode } from "react";

import { ThemeToggle } from "../../app/theme/ThemeToggle";
import logoUrl from "../../assets/applytogether-logo.png";

const VALUES = ["Shared pipeline", "Weekly goals", "Team accountability"];

export function AuthLayout({
  title,
  description,
  children,
  footer,
  wide = false,
  live = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Widens the card for longer forms such as sign up. */
  wide?: boolean;
  /** Announces heading changes, for pages whose state changes in place. */
  live?: boolean;
}) {
  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground [font-family:'Space_Grotesk',system-ui,sans-serif]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_42%_at_50%_0%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_72%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(color-mix(in_srgb,var(--primary)_18%,transparent)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(50%_45%_at_50%_28%,black,transparent)]"
      />
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <div
          className={`w-full ${wide ? "max-w-[30rem]" : "max-w-[25rem]"} motion-safe:animate-[auth-enter_480ms_cubic-bezier(0.16,1,0.3,1)_both]`}
        >
          <div
            aria-live={live ? "polite" : undefined}
            className="mb-8 flex flex-col items-center text-center"
          >
            <span className="mb-6 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-black p-1 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_28%,transparent),0_14px_44px_-10px_color-mix(in_srgb,var(--primary)_40%,transparent)]">
              <img
                src={logoUrl}
                alt="ApplyTogether"
                className="h-full w-full object-contain"
              />
            </span>
            <h1 className="text-balance text-[1.85rem] font-bold leading-tight tracking-[-0.02em] text-foreground">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-[24rem] text-pretty text-[0.95rem] leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>

          {children ? (
            <div className="rounded-2xl border border-border bg-card/85 p-6 shadow-[var(--shadow-raised)] ring-1 ring-inset ring-white/[0.03] backdrop-blur sm:p-7">
              {children}
            </div>
          ) : null}

          {footer ? (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          ) : null}
        </div>
      </div>

      <footer className="relative flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-6 pb-8 text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {VALUES.map((value, index) => (
          <span key={value} className="flex items-center gap-4">
            {index > 0 ? (
              <span aria-hidden="true" className="hidden text-primary/50 sm:inline">
                ◆
              </span>
            ) : null}
            {value}
          </span>
        ))}
      </footer>
    </main>
  );
}
