import { useCallback, useEffect, useState } from "react";
import { ArchiveRestore, LoaderCircle, RotateCcw, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import { type ApiClient, applicationsApi } from "../applications/api";
import type { DeletedApplication, PaginatedApplications } from "../applications/types";
import { Monogram, StatusBadge } from "../applications/wall/wallParts";
import { shortDate } from "../dashboard/dashboardModel";

const FULL_PAGE_SIZE = 10;
const PREVIEW_SIZE = 3;

export const BIN_SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40";

/**
 * The member's personal bin of deleted applications: restore one, or select
 * some (or all) and erase them for good. `preview` shows only the newest few,
 * without bulk actions or paging.
 */
export function DeletedBin({
  client,
  workspaceId,
  preview = false,
  onCount,
  onChanged,
}: {
  client: ApiClient;
  workspaceId: string;
  preview?: boolean;
  /** Reports the total number of deleted applications after each load. */
  onCount?(count: number): void;
  /** Called after a restore or permanent delete. */
  onChanged?(): void;
}) {
  const pageSize = preview ? PREVIEW_SIZE : FULL_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedApplications<DeletedApplication> | null>(null);
  const [error, setError] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(false);
  const [erasing, setErasing] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await applicationsApi.deleted(client, workspaceId, page, pageSize);
      // Restoring the last item on a later page leaves that page empty.
      if (next.items.length === 0 && page > 1) {
        setPage(page - 1);
        return;
      }
      setResult(next);
      setError(false);
      onCount?.(next.pagination.total_items);
    } catch {
      setError(true);
    }
  }, [client, workspaceId, page, pageSize, onCount]);

  useEffect(() => void load(), [load]);

  const leaveSelection = () => {
    setSelecting(false);
    setSelected(new Set());
    setAllSelected(false);
  };

  const toggle = (id: string) => {
    if (allSelected) {
      // Unticking one row after "Select all" keeps the rest of this page ticked.
      setAllSelected(false);
      setSelected(new Set((result?.items ?? []).map((item) => item.id).filter((itemId) => itemId !== id)));
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const restore = async (application: DeletedApplication) => {
    try {
      await applicationsApi.restore(client, workspaceId, application.id);
      toast.success(`${application.company_name} restored.`);
      await load();
      onChanged?.();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Restore failed.");
    }
  };

  const total = result?.pagination.total_items ?? 0;
  const selectedCount = allSelected ? total : selected.size;

  const erase = async () => {
    if (selectedCount === 0 || erasing) return;
    const noun = selectedCount === 1 ? "application" : "applications";
    if (!window.confirm(`Permanently delete ${selectedCount} ${noun}? This cannot be undone or restored.`)) {
      return;
    }
    setErasing(true);
    try {
      const response = await applicationsApi.permanentlyDelete(
        client,
        workspaceId,
        allSelected ? [] : [...selected],
        allSelected,
      );
      toast.success(
        `${response.deleted_count} ${response.deleted_count === 1 ? "application" : "applications"} permanently deleted.`,
      );
      leaveSelection();
      if (page !== 1) setPage(1);
      else await load();
      onChanged?.();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Permanent deletion failed.");
    } finally {
      setErasing(false);
    }
  };

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        The deleted applications could not load.{" "}
        <button type="button" className="underline" onClick={() => void load()}>
          Try again
        </button>
      </p>
    );
  }

  if (!result) {
    return (
      <div aria-busy="true" aria-label="Loading deleted applications" className="space-y-2">
        {Array.from({ length: preview ? 2 : 4 }, (_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-lg bg-secondary" />
        ))}
      </div>
    );
  }

  if (result.items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-8 text-center">
        <ArchiveRestore size={22} aria-hidden="true" className="text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-foreground">Nothing deleted</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Applications you delete stay here until you restore them or erase them for good.
        </p>
      </div>
    );
  }

  return (
    <div>
      {!preview ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {selecting
              ? `${selectedCount} of ${total} selected`
              : `${total} deleted · only you can see these`}
          </p>
          {selecting ? (
            <span className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (allSelected) {
                    setAllSelected(false);
                    setSelected(new Set());
                  } else {
                    setAllSelected(true);
                  }
                }}
                className={BIN_SECONDARY_BUTTON}
              >
                {allSelected ? "Clear selection" : `Select all ${total}`}
              </button>
              <button
                type="button"
                onClick={leaveSelection}
                className="px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={erasing || selectedCount === 0}
                onClick={() => void erase()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {erasing ? (
                  <LoaderCircle size={13} aria-hidden="true" className="animate-spin" />
                ) : (
                  <Trash2 size={13} aria-hidden="true" />
                )}
                Delete forever
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setSelecting(true)} className={BIN_SECONDARY_BUTTON}>
              <Trash2 size={13} aria-hidden="true" /> Select to erase
            </button>
          )}
        </div>
      ) : null}

      <ul aria-label="Deleted applications" className="divide-y divide-border rounded-xl border border-border">
        <AnimatePresence initial={false}>
          {result.items.map((application) => {
            const checked = allSelected || selected.has(application.id);
            return (
              <motion.li
                key={application.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 24 }}
                className={`flex items-center gap-3 px-3 py-3 ${selecting && checked ? "bg-destructive/[0.06]" : ""}`}
              >
                {selecting ? (
                  <input
                    type="checkbox"
                    aria-label={`Select ${application.company_name}, ${application.job_title}`}
                    checked={checked}
                    onChange={() => toggle(application.id)}
                    className="h-4 w-4 flex-none cursor-pointer accent-destructive"
                  />
                ) : null}
                <Monogram name={application.company_name} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {application.company_name}
                    </span>
                    <span className="hidden sm:inline-flex">
                      <StatusBadge status={application.status} />
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {application.job_title} · deleted {shortDate(application.deleted_at)}
                    {application.moderated ? ` by ${application.deleted_by.display_name}` : ""}
                  </span>
                </span>
                {!selecting ? (
                  <button
                    type="button"
                    aria-label={`Restore ${application.company_name}, ${application.job_title}`}
                    onClick={() => void restore(application)}
                    className={BIN_SECONDARY_BUTTON}
                  >
                    <RotateCcw size={13} aria-hidden="true" /> Restore
                  </button>
                ) : null}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {!preview && result.pagination.total_pages > 1 ? (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className={BIN_SECONDARY_BUTTON}
          >
            Previous
          </button>
          Page {page} of {result.pagination.total_pages}
          <button
            type="button"
            disabled={page >= result.pagination.total_pages}
            onClick={() => setPage(page + 1)}
            className={BIN_SECONDARY_BUTTON}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
