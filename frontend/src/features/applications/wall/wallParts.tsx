import type { ReactNode } from "react";

import { STATUS_META } from "../../dashboard/dashboardModel";
import { avatarColor, initials } from "../../members/avatar";
import type { ApplicationStatus, OwnerSummary } from "../types";

/** Company initials on a tile tinted with the company's colour. */
export function Monogram({ name, size = 40 }: { name: string; size?: number }) {
  const color = avatarColor(name);
  return (
    <span
      aria-hidden="true"
      className="font-display inline-flex flex-none items-center justify-center rounded-lg border font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        color,
        background: `${color}1f`,
        borderColor: `${color}55`,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function OwnerAvatar({ owner, size = 22 }: { owner: OwnerSummary; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex flex-none items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: avatarColor(owner.id),
      }}
    >
      {initials(owner.display_name)}
    </span>
  );
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const { label, color } = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{ color, borderColor: `${color}55`, background: `${color}14` }}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded border border-border bg-secondary/60 px-1.5 py-0.5 text-[11px] text-subtle">
      {children}
    </span>
  );
}
