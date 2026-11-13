import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router";
import { ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { ARRANGEMENT_META, shortDate, timeAgo } from "../../dashboard/dashboardModel";
import { EYEBROW, PRIMARY_BUTTON } from "../../dashboard/dashboardStyles";
import { avatarColor } from "../../members/avatar";
import type { JobApplication } from "../types";
import { EMPLOYMENT_LABELS, compactSalary, sentAgo } from "./wallModel";
import { Monogram, OwnerAvatar, StatusBadge, Tag } from "./wallParts";

const SECONDARY_LINK =
  "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

/**
 * Slide-out panel with an application's details and actions. Closes on
 * Escape or a click outside; the caller returns focus to what opened it.
 */
export function ApplicationDrawer({
  application,
  canEdit,
  canDelete,
  onClose,
  onDelete,
}: {
  application: JobApplication | null;
  canEdit: boolean;
  canDelete: boolean;
  onClose(): void;
  /** Resolves true once the application has been moved to Recently deleted. */
  onDelete(application: JobApplication): Promise<boolean>;
}) {
  const [deleting, setDeleting] = useState(false);
  const open = application !== null;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const remove = async () => {
    if (!application || deleting) return;
    setDeleting(true);
    try {
      if (await onDelete(application)) onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {application ? (
        <motion.div
          key="application-drawer"
          className="fixed inset-0 z-[90]"
          initial="closed"
          animate="open"
          exit="closed"
        >
          <motion.button
            type="button"
            tabIndex={-1}
            aria-label="Close details"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-black/35 backdrop-blur dark:bg-black/60-[2px]"
            variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
            transition={{ duration: 0.25 }}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="application-drawer-title"
            variants={{ open: { x: 0 }, closed: { x: "100%" } }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col border-l border-border bg-card text-foreground shadow-[var(--shadow-raised)]"
          >
            <header className="relative overflow-hidden border-b border-border p-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(70% 120% at 0% 0%, ${avatarColor(application.company_name)}2e, transparent 70%)`,
                }}
              />
              <div className="relative flex items-start gap-4">
                <Monogram name={application.company_name} size={56} />
                <div className="min-w-0 flex-1">
                  <h2
                    id="application-drawer-title"
                    className="font-display text-xl font-semibold leading-tight text-foreground"
                  >
                    {application.company_name}
                  </h2>
                  <p className="mt-0.5 text-sm text-subtle">{application.job_title}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={application.status} />
                    <Tag>{ARRANGEMENT_META[application.work_arrangement].label}</Tag>
                    <Tag>{EMPLOYMENT_LABELS[application.employment_type]}</Tag>
                  </div>
                </div>
                <button
                  type="button"
                  autoFocus
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {(
                  [
                    [
                      "Owner",
                      <span key="owner" className="flex items-center gap-2">
                        <OwnerAvatar owner={application.owner} />
                        {application.owner.display_name}
                      </span>,
                    ],
                    [
                      "Applied",
                      `${shortDate(application.application_date)} · ${sentAgo(application.application_date)}`,
                    ],
                    ["Location", application.location || "Not provided"],
                    ["Salary", compactSalary(application) ?? "Not provided"],
                    ["Last updated", timeAgo(application.updated_at)],
                    ["Added", shortDate(application.created_at)],
                  ] as [string, ReactNode][]
                ).map(([label, value], index) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.12 + index * 0.04 }}
                  >
                    <dt className={EYEBROW}>{label}</dt>
                    <dd className="mt-1 text-foreground">{value}</dd>
                  </motion.div>
                ))}
              </dl>
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.38 }}
                className="mt-7"
              >
                <h3 className={`${EYEBROW} mb-2`}>Notes</h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-subtle">
                  {application.notes || "No notes yet."}
                </p>
              </motion.section>
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.44 }}
                className="mt-6"
              >
                <h3 className={`${EYEBROW} mb-2`}>Job description</h3>
                <p className="line-clamp-[12] whitespace-pre-line text-sm leading-relaxed text-subtle">
                  {application.job_description || "No description saved."}
                </p>
              </motion.section>
            </div>

            <footer className="flex flex-wrap items-center gap-2 border-t border-border p-4">
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={deleting}
                  className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 disabled:opacity-50"
                >
                  <Trash2 size={12} /> {deleting ? "Moving…" : "Delete"}
                </button>
              ) : null}
              {application.job_posting_url ? (
                <a
                  href={application.job_posting_url}
                  target="_blank"
                  rel="noreferrer"
                  className={`${SECONDARY_LINK} ${canDelete ? "" : "ml-auto"}`}
                >
                  Job posting <ExternalLink size={12} />
                </a>
              ) : null}
              {canEdit ? (
                <Link to={`/applications/${application.id}/edit`} className={SECONDARY_LINK}>
                  <Pencil size={12} /> Edit
                </Link>
              ) : null}
              <Link to={`/applications/${application.id}`} className={PRIMARY_BUTTON}>
                Open full record
              </Link>
            </footer>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
