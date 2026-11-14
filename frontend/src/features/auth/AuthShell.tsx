// The page frame for the smaller auth pages (forgot / reset password), in
// the same look as the sign-in page: soft glow, drifting company wall on
// wide screens, the logo linking home, and a card that rises in.
import type { ReactNode } from "react";
import { Link } from "react-router";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

import { ThemeToggle } from "../../app/theme/ThemeToggle";
import logoUrl from "../../assets/applytogether-logo.png";
import { EASE_OUT } from "../dashboard/dashboardStyles";
import { WallBackdrop } from "./WallBackdrop";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground [font-family:'Space_Grotesk',system-ui,sans-serif]">
        <WallBackdrop />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background:radial-gradient(40%_35%_at_50%_25%,color-mix(in_srgb,var(--primary)_10%,transparent),transparent_70%)]"
        />
        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>

        <div className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-[24rem]">
            <motion.div
              className="mb-6 flex justify-center"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            >
              <Link
                to="/"
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-black p-1 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_28%,transparent),0_14px_44px_-10px_color-mix(in_srgb,var(--primary)_40%,transparent)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <img src={logoUrl} alt="ApplyTogether home" className="h-full w-full object-contain" />
              </Link>
            </motion.div>

            <div className="mb-7 text-center" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                >
                  <h1 className="text-balance text-[1.85rem] font-bold leading-tight tracking-[-0.02em]">
                    {title}
                  </h1>
                  <p className="mt-1.5 text-pretty text-[0.95rem] leading-6 text-muted-foreground">
                    {description}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <motion.div
              className="rounded-2xl border border-border bg-card/90 p-6 shadow-[var(--shadow-raised)] ring-1 ring-inset ring-white/[0.03] backdrop-blur sm:p-7"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.15 }}
            >
              {children}
            </motion.div>

            {footer ? (
              <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
            ) : null}
          </div>
        </div>
      </main>
    </MotionConfig>
  );
}
