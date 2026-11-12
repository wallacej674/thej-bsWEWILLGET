// Shared dashboard styling constants.

/** Ease-out curve used by every dashboard entrance animation. */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Raised panel surface, matching the rest of the app's cards. */
export const PANEL =
  "rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/[0.03]";

export const EYEBROW =
  "text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

export const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/35 bg-secondary px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-[#3a2a17] disabled:cursor-not-allowed disabled:opacity-50";
