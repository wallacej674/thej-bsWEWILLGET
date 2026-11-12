// Shared class names for the auth pages (sign in, sign up, email
// verification), so every form inside the AuthLayout card matches.

export const authLabelClass =
  "mb-2 block text-[0.8rem] font-semibold text-subtle";

export const authInputClass =
  "h-12 w-full rounded-xl border border-border bg-input px-4 text-[0.95rem] text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15";

export const authPrimaryButtonClass =
  "inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-[0.95rem] font-semibold text-primary-foreground shadow-[0_8px_24px_-10px_color-mix(in_srgb,var(--primary)_70%,transparent)] transition hover:bg-primary/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-60";

export const authLinkClass =
  "rounded-sm font-bold text-primary transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";
