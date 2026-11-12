import { forwardRef, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";

import { ARRANGEMENT_META, STATUS_META } from "../../dashboard/dashboardModel";
import { EASE_OUT } from "../../dashboard/dashboardStyles";
import { avatarColor, initials } from "../../members/avatar";
import type { JobApplication } from "../types";
import { compactSalary, sentAgo } from "./wallModel";
import { OwnerAvatar, StatusBadge } from "./wallParts";

const MAX_TILT_DEGREES = 14;

interface WallTileProps {
  application: JobApplication;
  index: number;
  featured: boolean;
  /** Receives the tile too, so focus can return to it when details close. */
  onOpen(application: JobApplication, tile: HTMLElement | null): void;
}

/**
 * One company on the wall: big initials, a status-coloured top edge, a tilt
 * that follows the cursor, and details that slide up on hover or focus.
 * Forwards its ref to the list item so AnimatePresence's "popLayout" mode can
 * measure tiles as they leave.
 */
export const WallTile = forwardRef<HTMLLIElement, WallTileProps>(function WallTile(
  { application, index, featured, onOpen },
  itemRef,
) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const rotateX = useSpring(tiltX, { stiffness: 220, damping: 18 });
  const rotateY = useSpring(tiltY, { stiffness: 220, damping: 18 });
  const color = avatarColor(application.company_name);
  const statusColor = STATUS_META[application.status].color;
  const salary = compactSalary(application);

  return (
    <motion.li
      ref={itemRef}
      layout
      initial={{ opacity: 0, scale: 0.92, filter: "blur(6px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.5, ease: EASE_OUT, delay: Math.min(index, 14) * 0.035 }}
      className={featured ? "col-span-2 row-span-2" : ""}
      style={{ perspective: 900 }}
    >
      <motion.button
        ref={ref}
        type="button"
        aria-haspopup="dialog"
        aria-label={`${application.company_name}, ${application.job_title}. ${STATUS_META[application.status].label}, sent ${sentAgo(application.application_date)}. Open details`}
        onClick={() => onOpen(application, ref.current)}
        onMouseMove={(event) => {
          const node = ref.current;
          if (!node || reduce) return;
          const rect = node.getBoundingClientRect();
          tiltY.set(((event.clientX - rect.left) / rect.width - 0.5) * MAX_TILT_DEGREES);
          tiltX.set(-((event.clientY - rect.top) / rect.height - 0.5) * MAX_TILT_DEGREES);
        }}
        onMouseLeave={() => {
          tiltX.set(0);
          tiltY.set(0);
        }}
        style={{ rotateX, rotateY }}
        className={`group relative flex w-full flex-col overflow-hidden rounded-2xl border border-border p-4 text-left shadow-[var(--shadow-panel)] transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
          featured ? "h-full min-h-[260px]" : "aspect-square"
        }`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 90% at 20% 0%, ${color}26, transparent 60%), var(--card)`,
          }}
        />
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: statusColor }} />
        <span aria-hidden="true" className="relative flex items-start justify-between gap-2">
          <StatusBadge status={application.status} />
          <span className="text-[10px] text-muted-foreground">{sentAgo(application.application_date)}</span>
        </span>
        <span
          aria-hidden="true"
          className={`font-display relative mt-auto font-bold leading-none tracking-[-0.04em] ${
            featured ? "text-[5.5rem]" : "text-[3.1rem]"
          }`}
          style={{ color }}
        >
          {initials(application.company_name)}
        </span>
        {featured ? (
          <span
            aria-hidden="true"
            className="relative mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary"
          >
            Newest
          </span>
        ) : null}
        <span aria-hidden="true" className="relative mt-2 block truncate text-sm font-semibold text-foreground">
          {application.company_name}
        </span>
        <span aria-hidden="true" className="relative block truncate text-xs text-subtle">
          {application.job_title}
        </span>
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-card via-card/95 to-card/0 p-4 pt-10 text-xs text-foreground transition-transform duration-300 ease-out group-hover:translate-y-0 group-focus-visible:translate-y-0"
        >
          <span className="block truncate text-sm font-semibold text-foreground">
            {application.company_name}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <OwnerAvatar owner={application.owner} size={18} />
            {application.owner.display_name}
          </span>
          <span className="mt-1 block truncate text-subtle">
            {application.location || "Location not set"} ·{" "}
            {ARRANGEMENT_META[application.work_arrangement].label}
          </span>
          <span className="mt-0.5 block text-subtle">{salary ?? "Salary not listed"}</span>
        </span>
      </motion.button>
    </motion.li>
  );
});
