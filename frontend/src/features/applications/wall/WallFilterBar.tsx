import { useEffect, useRef, useState } from "react";
import { ArrowDownUp, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";

import { DarkSelect } from "../../../app/components/DarkSelect";
import { ARRANGEMENT_META, STATUS_META } from "../../dashboard/dashboardModel";
import { EASE_OUT } from "../../dashboard/dashboardStyles";
import type {
  ApplicationFilters,
  ApplicationStatus,
  EmploymentType,
  OwnerSummary,
  SortField,
  WorkArrangement,
} from "../types";
import { EMPLOYMENT_LABELS, SORT_OPTIONS, activeFilterCount } from "./wallModel";
import { OwnerAvatar } from "./wallParts";

const STATUSES = Object.keys(STATUS_META) as ApplicationStatus[];
const ARRANGEMENTS = Object.keys(ARRANGEMENT_META) as WorkArrangement[];

/** Search box that waits for a pause in typing before applying the query. */
function SearchBox({ value, onChange }: { value: string; onChange(value: string): void }) {
  const [draft, setDraft] = useState(value);
  const sent = useRef(value);

  useEffect(() => {
    if (value !== sent.current) {
      sent.current = value;
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    if (draft === sent.current) return;
    const timer = window.setTimeout(() => {
      sent.current = draft;
      onChange(draft);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draft, onChange]);

  return (
    <label className="relative block min-w-0 flex-1 sm:max-w-64">
      <span className="sr-only">Search company or role</span>
      <Search
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Search company or role"
        className="h-9 w-full rounded-lg border border-border bg-input pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
      />
      {draft ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setDraft("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X size={13} />
        </button>
      ) : null}
    </label>
  );
}

function StatusPills({
  value,
  onChange,
  counts,
  total,
  groupId,
}: {
  value: ApplicationStatus | "";
  onChange(value: ApplicationStatus | ""): void;
  counts: Record<ApplicationStatus, number> | null;
  total: number | null;
  groupId: string;
}) {
  const options: { value: ApplicationStatus | ""; label: string; color?: string; count?: number }[] = [
    { value: "", label: "All", count: total ?? undefined },
    ...STATUSES.map((status) => ({
      value: status,
      label: STATUS_META[status].label,
      color: STATUS_META[status].color,
      count: counts?.[status],
    })),
  ];
  return (
    <LayoutGroup id={groupId}>
      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1">
        {options.map((option) => {
          const on = value === option.value;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(option.value)}
              className={`relative rounded-full px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                on ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {on ? (
                <motion.span
                  layoutId={`${groupId}-pill`}
                  className="absolute inset-0 rounded-full border border-primary/40 bg-secondary"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className="relative flex items-center gap-1.5">
                {option.color ? (
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: option.color }}
                  />
                ) : null}
                {option.label}
                {option.count !== undefined ? (
                  <span className="font-numeric text-[10px] text-muted-foreground">{option.count}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

function OwnerToggles({
  owners,
  active,
  onChange,
}: {
  owners: OwnerSummary[];
  active: string;
  onChange(ownerId: string): void;
}) {
  if (owners.length === 0) return null;
  return (
    <div role="group" aria-label="Filter by owner" className="flex items-center gap-1">
      {owners.map((owner) => {
        const on = active === owner.id;
        return (
          <motion.button
            key={owner.id}
            type="button"
            aria-pressed={on}
            aria-label={`Only ${owner.display_name}`}
            title={owner.display_name}
            onClick={() => onChange(on ? "" : owner.id)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.92 }}
            className={`rounded-full p-0.5 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
              active && !on ? "opacity-40 hover:opacity-80" : ""
            } ${on ? "ring-2 ring-primary" : "ring-1 ring-transparent"}`}
          >
            <OwnerAvatar owner={owner} size={26} />
          </motion.button>
        );
      })}
    </div>
  );
}

function FilterControls({
  filters,
  statusCounts,
  total,
  owners,
  onChange,
  groupId,
}: {
  filters: ApplicationFilters;
  statusCounts: Record<ApplicationStatus, number> | null;
  total: number | null;
  owners: OwnerSummary[];
  onChange(changes: Partial<ApplicationFilters>): void;
  groupId: string;
}) {
  return (
    <>
      <StatusPills
        value={filters.status}
        onChange={(status) => onChange({ status })}
        counts={statusCounts}
        total={total}
        groupId={groupId}
      />
      <OwnerToggles
        owners={owners}
        active={filters.ownerId}
        onChange={(ownerId) => onChange({ ownerId })}
      />
      <div className="w-40">
        <DarkSelect
          ariaLabel="Work arrangement"
          value={filters.workArrangement}
          onChange={(value) => onChange({ workArrangement: value as WorkArrangement | "" })}
          options={[
            { value: "", label: "Any arrangement" },
            ...ARRANGEMENTS.map((value) => ({ value, label: ARRANGEMENT_META[value].label })),
          ]}
        />
      </div>
      <div className="w-36">
        <DarkSelect
          ariaLabel="Employment type"
          value={filters.employmentType}
          onChange={(value) => onChange({ employmentType: value as EmploymentType | "" })}
          options={[
            { value: "", label: "Any type" },
            ...Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-36">
          <DarkSelect
            ariaLabel="Sort by"
            value={filters.sortBy}
            onChange={(value) => onChange({ sortBy: value as SortField })}
            options={SORT_OPTIONS}
          />
        </div>
        <button
          type="button"
          aria-label={filters.sortOrder === "asc" ? "Ascending order" : "Descending order"}
          title={filters.sortOrder === "asc" ? "Ascending" : "Descending"}
          onClick={() => onChange({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" })}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-input text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <motion.span animate={{ rotate: filters.sortOrder === "asc" ? 180 : 0 }}>
            <ArrowDownUp size={14} />
          </motion.span>
        </button>
      </div>
    </>
  );
}

/**
 * Filters for the wall. Pinned under the app header on larger screens; on
 * phones the controls fold behind a "Filters" button to keep tiles visible.
 */
export function WallFilterBar({
  filters,
  statusCounts,
  total,
  owners,
  onChange,
  onClear,
}: {
  filters: ApplicationFilters;
  statusCounts: Record<ApplicationStatus, number> | null;
  total: number | null;
  owners: OwnerSummary[];
  onChange(changes: Partial<ApplicationFilters>): void;
  onClear(): void;
}) {
  const [open, setOpen] = useState(false);
  const active = activeFilterCount(filters);
  const controls = { filters, statusCounts, total, owners, onChange };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.05 }}
      className="relative z-30 mb-8 rounded-2xl border border-border bg-card/85 p-2 shadow-[var(--shadow-raised)] backdrop-blur-md md:sticky md:top-[4.5rem]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={filters.search} onChange={(search) => onChange({ search })} />
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs md:hidden ${
            active
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-input text-muted-foreground"
          }`}
        >
          <SlidersHorizontal size={13} aria-hidden="true" />
          Filters{active ? ` · ${active}` : ""}
          <motion.span animate={{ rotate: open ? 180 : 0 }}>
            <ChevronDown size={13} aria-hidden="true" />
          </motion.span>
        </button>
        <div className="hidden flex-wrap items-center gap-2 md:flex md:flex-1">
          <FilterControls {...controls} groupId="wall-status" />
        </div>
        {active ? (
          <button
            type="button"
            onClick={onClear}
            className="hidden px-2 text-xs text-muted-foreground hover:text-primary md:ml-auto md:block"
          >
            Clear
          </button>
        ) : null}
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="overflow-hidden md:hidden"
          >
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <FilterControls {...controls} groupId="wall-status-mobile" />
              {active ? (
                <button
                  type="button"
                  onClick={onClear}
                  className="px-2 text-xs text-muted-foreground hover:text-primary"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
