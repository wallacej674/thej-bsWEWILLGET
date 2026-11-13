import { type ReactNode, useCallback, useRef, useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

import { DarkSelect } from "../../../app/components/DarkSelect";
import { EASE_OUT, PANEL, PRIMARY_BUTTON } from "../../dashboard/dashboardStyles";
import { CountUp } from "../../dashboard/motion";
import type {
  ApplicationFilters,
  ApplicationStatus,
  JobApplication,
  OwnerSummary,
  Pagination,
} from "../types";
import { ApplicationDrawer } from "./ApplicationDrawer";
import { WallFilterBar } from "./WallFilterBar";
import { WallTile } from "./WallTile";
import {
  activeFilterCount,
  canDeleteApplication,
  canEditApplication,
  featuresNewest,
} from "./wallModel";

const GRID = "grid grid-flow-dense grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

export interface WallFacets {
  statusCounts: Record<ApplicationStatus, number>;
  owners: OwnerSummary[];
  total: number;
}

function LoadingBar({ active }: { active: boolean }) {
  return (
    <div aria-hidden="true" className="relative mb-3 h-0.5 overflow-hidden">
      <AnimatePresence>
        {active ? (
          <motion.div
            className="absolute inset-y-0 w-1/3 rounded-full bg-primary/70"
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: "300%", opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function WallSkeleton() {
  return (
    <div className={GRID} aria-busy="true" aria-label="Loading applications">
      {Array.from({ length: 10 }, (_, index) => (
        <div
          key={index}
          className={`animate-pulse rounded-2xl border border-border bg-card ${
            index === 0 ? "col-span-2 row-span-2" : "aspect-square"
          }`}
        />
      ))}
    </div>
  );
}

function EmptyWall({ filtered, onClear }: { filtered: boolean; onClear(): void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${PANEL} flex flex-col items-center px-6 py-16 text-center`}
    >
      <Search size={22} aria-hidden="true" className="text-primary/70" />
      <p className="mt-3 text-sm font-medium text-foreground">
        {filtered ? "No applications match these filters" : "No applications yet"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {filtered
          ? "Try clearing a filter to see more of the wall."
          : "Add the first application and it will show up here."}
      </p>
      <div className="mt-5">
        {filtered ? (
          <button type="button" onClick={onClear} className={PRIMARY_BUTTON}>
            Clear filters
          </button>
        ) : (
          <Link to="/applications/new" className={PRIMARY_BUTTON}>
            <Plus size={15} aria-hidden="true" /> Add application
          </Link>
        )}
      </div>
    </motion.div>
  );
}

function WallPager({
  pagination,
  pageSize,
  onPage,
  onPageSize,
}: {
  pagination: Pagination;
  pageSize: number;
  onPage(page: number): void;
  onPageSize(size: number): void;
}) {
  const last = Math.max(1, pagination.total_pages);
  const page = pagination.page;
  const pages =
    last <= 7
      ? Array.from({ length: last }, (_, index) => index + 1)
      : [...new Set([1, page - 1, page, page + 1, last])]
          .filter((value) => value >= 1 && value <= last)
          .sort((a, b) => a - b);

  return (
    <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        <span className="font-numeric text-foreground">{pagination.total_items}</span>{" "}
        application{pagination.total_items === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-3">
        <div className="w-28">
          <DarkSelect
            ariaLabel="Applications per page"
            value={String(pageSize)}
            onChange={(value) => onPageSize(Number(value))}
            options={[10, 20, 50].map((size) => ({ value: String(size), label: `${size} per page` }))}
          />
        </div>
        <nav aria-label="Pages" className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft size={15} />
          </button>
          {pages.map((value, index) => (
            <span key={value} className="flex items-center">
              {index > 0 && value - pages[index - 1] > 1 ? (
                <span aria-hidden="true" className="px-1 text-xs text-muted-foreground">
                  …
                </span>
              ) : null}
              <button
                type="button"
                aria-label={`Page ${value}`}
                aria-current={value === page ? "page" : undefined}
                onClick={() => onPage(value)}
                className={`font-numeric relative h-7 min-w-7 rounded-md px-2 text-xs ${
                  value === page ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {value === page ? (
                  <motion.span
                    layoutId="wall-page"
                    className="absolute inset-0 rounded-md bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                ) : null}
                <span className="relative">{value}</span>
              </button>
            </span>
          ))}
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= last}
            onClick={() => onPage(page + 1)}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight size={15} />
          </button>
        </nav>
      </div>
    </div>
  );
}

/**
 * The Applications page as a wall of company tiles. Data loading and the
 * URL-backed filters live with the caller; this renders and reports intent.
 */
export function CompanyWall({
  applications,
  pagination,
  loading,
  error,
  filters,
  facets,
  userId,
  canModerate,
  onFiltersChange,
  onClearFilters,
  onDelete,
  renderSidePanel,
}: {
  /** null until the first page has loaded. */
  applications: JobApplication[] | null;
  pagination: Pagination | null;
  loading: boolean;
  /** Rendered in place of the wall when loading failed. */
  error?: ReactNode;
  filters: ApplicationFilters;
  facets: WallFacets | null;
  userId: string;
  canModerate: boolean;
  onFiltersChange(changes: Partial<ApplicationFilters>, resetPage?: boolean): void;
  onClearFilters(): void;
  /** Asks to move an application to Recently deleted; resolves true when it was. */
  onDelete(application: JobApplication): Promise<boolean>;
  /** Workspace shown beside an application's details (the résumé tailor). */
  renderSidePanel?(application: JobApplication, canEdit: boolean): ReactNode;
}) {
  const [selected, setSelected] = useState<JobApplication | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const open = useCallback((application: JobApplication, tile: HTMLElement | null) => {
    opener.current = tile;
    setSelected(application);
  }, []);
  // Hand focus back to the tile that opened the details.
  const close = useCallback(() => {
    setSelected(null);
    opener.current?.focus();
  }, []);
  const applyFilters = useCallback(
    (changes: Partial<ApplicationFilters>) => onFiltersChange(changes),
    [onFiltersChange],
  );
  const featured = featuresNewest(filters);

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-[1380px] px-4 py-8 sm:px-6">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="mb-6 flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <h1 className="font-display flex items-baseline gap-3 text-2xl font-semibold tracking-tight text-foreground">
              Applications
              {pagination ? (
                <span className="font-numeric rounded-full border border-border bg-card px-2.5 py-0.5 text-sm font-normal text-muted-foreground">
                  <CountUp value={pagination.total_items} />
                </span>
              ) : null}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every company your workspace is talking to, at a glance.
            </p>
          </div>
          <Link to="/applications/new" className={PRIMARY_BUTTON}>
            <Plus size={15} aria-hidden="true" /> Add application
          </Link>
        </motion.header>

        <WallFilterBar
          filters={filters}
          statusCounts={facets?.statusCounts ?? null}
          total={facets?.total ?? null}
          owners={facets?.owners ?? []}
          onChange={applyFilters}
          onClear={onClearFilters}
        />

        <LoadingBar active={loading && applications !== null} />
        {error ? (
          error
        ) : applications === null ? (
          <WallSkeleton />
        ) : applications.length === 0 ? (
          <EmptyWall filtered={activeFilterCount(filters) > 0} onClear={onClearFilters} />
        ) : (
          <ul aria-label="Applications" className={GRID}>
            <AnimatePresence mode="popLayout">
              {applications.map((application, index) => (
                <WallTile
                  key={application.id}
                  application={application}
                  index={index}
                  featured={featured && index === 0}
                  onOpen={open}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}

        {applications?.length && pagination ? (
          <WallPager
            pagination={pagination}
            pageSize={filters.pageSize}
            onPage={(page) => onFiltersChange({ page }, false)}
            onPageSize={(pageSize) => onFiltersChange({ pageSize })}
          />
        ) : null}
      </div>

      <ApplicationDrawer
        application={selected}
        canEdit={selected ? canEditApplication(selected, userId) : false}
        canDelete={selected ? canDeleteApplication(selected, userId, canModerate) : false}
        onClose={close}
        onDelete={onDelete}
        sidePanel={
          selected && renderSidePanel
            ? renderSidePanel(selected, canEditApplication(selected, userId))
            : undefined
        }
      />
    </MotionConfig>
  );
}
