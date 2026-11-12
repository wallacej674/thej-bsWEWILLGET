// Shared dashboard styling constants.

/** Ease-out curve used by every dashboard entrance animation. */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Raised panel surface, matching the rest of the app's cards. */
export const PANEL =
  "rounded-xl border border-border bg-card shadow-[var(--shadow-panel)] ring-1 ring-inset ring-white/[0.03]";

export const EYEBROW =
  "text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

export const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:border-primary/90 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";
