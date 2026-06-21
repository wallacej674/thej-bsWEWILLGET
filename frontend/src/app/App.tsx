import {
  AlertCircle,
  ArrowLeft,
  ArrowUpDown,
  Briefcase,
  Building2,
  CheckCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Mail,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Trash,
  TrendingUp,
  User,
  UserPlus,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import * as RadixSelect from "@radix-ui/react-select";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Toaster, toast } from "sonner";

import { ApiError, createApiClient } from "../api/client";
import { ApplicationActions } from "../features/applications/ApplicationActions";
import {
  applicationsApi,
  sessionApi,
  type ApiClient,
  workspaceApi,
} from "../features/applications/api";
import {
  MAX_SALARY_AMOUNT,
  validateSalaryAmount,
} from "../features/applications/formValidation";
import type {
  ApplicationFilters,
  ApplicationPayload,
  ApplicationStatus,
  ApplicationSummary,
  CurrentUser,
  DeletedApplication,
  EmploymentType,
  JobApplication,
  PaginatedApplications,
  SalaryPeriod,
  SortField,
  WorkArrangement,
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
} from "../features/applications/types";
import {
  AuthProvider,
  useAuth,
} from "../features/auth/AuthProvider";
import { authApi } from "../features/auth/authApi";
import { LoginPage } from "../features/auth/LoginPage";
import {
  configuredDevelopmentIdentities,
  createIdentityStore,
  type DevelopmentIdentity,
} from "../features/session/identity";

interface SessionState {
  user: CurrentUser;
  workspace: Workspace;
}

interface DevelopmentIdentityControls {
  identities: DevelopmentIdentity[];
  selectedUserId: string;
  switchIdentity(userId: string): void;
}

interface AppContext {
  client: ApiClient;
  session: SessionState;
  workspaces: Workspace[];
  switchWorkspace(workspace: Workspace): void;
  refreshWorkspaces(): Promise<Workspace[]>;
  developmentIdentity?: DevelopmentIdentityControls;
  logout(): Promise<void>;
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
  identities?: DevelopmentIdentity[];
  selectedUserId?: string;
  switchIdentity?: (userId: string) => void;
}

const statusLabels: Record<ApplicationStatus, string> = {
  applied: "Applied",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  closed: "Closed",
};

const arrangementLabels: Record<WorkArrangement, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "Onsite",
  unknown: "Unknown",
};

const employmentLabels: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
  unknown: "Unknown",
};

const salaryPeriodLabels: Record<SalaryPeriod, string> = {
  hourly: "hour",
  monthly: "month",
  yearly: "year",
};

const defaultFilters: ApplicationFilters = {
  search: "",
  ownerId: "",
  status: "",
  workArrangement: "",
  employmentType: "",
  sortBy: "application_date",
  sortOrder: "desc",
  page: 1,
  pageSize: 10,
};

function formatDate(value: string): string {
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatSalary(application: JobApplication): string {
  if (!application.salary_min && !application.salary_max) return "Not provided";
  const currency = application.salary_currency ?? "USD";
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
  const range = [application.salary_min, application.salary_max]
    .filter(Boolean)
    .map((value) => formatter.format(Number(value)))
    .join(" – ");
  return application.salary_period
    ? `${range} / ${salaryPeriodLabels[application.salary_period]}`
    : range;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function userColor(id: string): string {
  return id.charCodeAt(0) % 2 === 0 ? "bg-indigo-600" : "bg-emerald-600";
}

function Avatar({
  id,
  name,
  size = "sm",
}: {
  id: string;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-xs",
    lg: "h-12 w-12 text-base",
  };
  return (
    <span
      className={`${sizes[size]} ${userColor(id)} inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function StatusPill({ status }: { status: ApplicationStatus }) {
  const colors: Record<ApplicationStatus, string> = {
    applied: "border-blue-500/25 bg-blue-500/15 text-blue-400",
    rejected: "border-red-500/25 bg-red-500/15 text-red-400",
    withdrawn: "border-slate-500/25 bg-slate-500/15 text-slate-400",
    closed: "border-amber-500/25 bg-amber-500/15 text-amber-400",
  };
  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${colors[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function ArrangementPill({ value }: { value: WorkArrangement }) {
  const styles: Record<WorkArrangement, string> = {
    remote: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    hybrid: "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
    onsite: "border-slate-500/30 bg-slate-500/10 text-slate-400",
    unknown: "border-slate-600/30 bg-slate-600/10 text-slate-500",
  };
  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${styles[value]}`}
    >
      {arrangementLabels[value]}
    </span>
  );
}

function EmploymentPill({ value }: { value: EmploymentType }) {
  return (
    <span className="inline-flex max-w-20 rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-medium leading-tight text-blue-400">
      {employmentLabels[value]}
    </span>
  );
}

function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

const emptySelectValue = "__applytogether_empty__";

function DarkSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  className?: string;
}) {
  const normalizedValue = value === "" ? emptySelectValue : value;

  return (
    <RadixSelect.Root
      value={normalizedValue}
      onValueChange={(nextValue) =>
        onChange(nextValue === emptySelectValue ? "" : nextValue)
      }
    >
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        className={`inline-flex min-h-8 w-full items-center justify-between gap-2 rounded-lg border border-white/[0.09] bg-[#151e2f] px-3 py-2 text-left text-xs text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-colors hover:border-white/[0.15] hover:bg-[#182235] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 data-[state=open]:border-indigo-500/35 data-[state=open]:bg-[#182235] ${className}`}
      >
        <RadixSelect.Value />
        <RadixSelect.Icon className="shrink-0 text-slate-500">
          <ChevronDown size={14} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="z-[100] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-white/[0.1] bg-[#111827] p-1.5 text-slate-300 shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
        >
          <RadixSelect.Viewport>
            {options.map((option) => {
              const optionValue =
                option.value === "" ? emptySelectValue : option.value;
              return (
                <RadixSelect.Item
                  key={optionValue}
                  value={optionValue}
                  className="relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-8 text-xs outline-none transition-colors data-[highlighted]:bg-indigo-500/15 data-[highlighted]:text-indigo-200 data-[state=checked]:text-white"
                >
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className="absolute right-2.5 text-indigo-400">
                    <Check size={13} />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              );
            })}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-[#111827] px-5 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/5">
        <FileText size={22} className="text-slate-600" />
      </div>
      <h2 className="text-base font-semibold text-slate-300">{title}</h2>
      <p className="mb-5 mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        {description}
      </p>
      {action}
    </div>
  );
}

function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-slate-500">
      <LoaderCircle className="animate-spin" size={17} />
      {label}
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message =
    error instanceof Error ? error.message : "Something unexpected happened.";
  return (
    <div
      className="rounded-xl border border-red-500/20 bg-red-500/5 p-5"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 flex-shrink-0 text-red-400" size={16} />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-red-300">
            Couldn’t load this view
          </h2>
          <p className="mt-1 text-sm text-slate-400">{message}</p>
          {onRetry && (
            <button
              className="mt-3 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10"
              onClick={onRetry}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function IdentityGate({
  identities,
  onSelect,
}: {
  identities: DevelopmentIdentity[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="dark flex min-h-screen items-center justify-center bg-[#0c1120] p-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#111827] p-7 shadow-2xl shadow-black/30">
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600">
          <Briefcase className="text-white" size={20} />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400">
          Development identity
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Who are you testing as?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          ApplyTogether uses the seeded backend UUIDs during Milestone 2. This
          selector disappears when production authentication replaces it.
        </p>
        {identities.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {identities.map((identity) => (
              <button
                key={identity.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-left text-slate-300 transition hover:border-indigo-500/30 hover:bg-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                onClick={() => onSelect(identity.id)}
              >
                <Avatar id={identity.id} name={identity.label} size="md" />
                <span>
                  <span className="block text-sm font-semibold">
                    {identity.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    Seeded user
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
            Add the UUIDs printed by the backend seed command to{" "}
            <code>frontend/.env</code>, using the names in{" "}
            <code>.env.example</code>.
          </div>
        )}
      </div>
    </div>
  );
}

function AppShell({ context }: { context: AppContext }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/applications", label: "Applications", icon: FileText },
    { to: "/deleted", label: "Deleted", icon: Trash },
    { to: "/workspace", label: "Workspace", icon: Users },
    { to: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="dark min-h-screen bg-[#0c1120] text-slate-200">
      <nav className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#090e1d]">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link
            to="/"
            className="flex flex-shrink-0 items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600">
              <Briefcase size={13} />
            </span>
            <span className="hidden text-sm font-semibold tracking-tight text-slate-100 sm:block">
              ApplyTogether
            </span>
          </Link>
          <span className="hidden text-xs text-slate-600 sm:block">/</span>
          <div className="hidden max-w-44 sm:block">
            <DarkSelect
              ariaLabel="Active workspace"
            value={context.session.workspace.id}
              onChange={(workspaceId) => {
              const workspace = context.workspaces.find(
                  (item) => item.id === workspaceId,
              );
              if (workspace) context.switchWorkspace(workspace);
            }}
              options={context.workspaces.map((workspace) => ({
                value: workspace.id,
                label: workspace.name,
              }))}
              className="min-h-7 py-1.5"
            />
          </div>
          <div className="hidden flex-1 items-center justify-center gap-0.5 md:flex">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "bg-indigo-600/20 text-indigo-400"
                      : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                  }`
                }
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
          </div>
          <Link
            to="/applications/new"
            className="ml-auto hidden items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 md:flex"
          >
            <Plus size={13} /> Add application
          </Link>
          {context.developmentIdentity ? (
            <label className="hidden text-xs text-amber-300 lg:block">
              <span className="sr-only">Active developer identity</span>
              <select
                value={context.developmentIdentity.selectedUserId}
                onChange={(event) =>
                  context.developmentIdentity?.switchIdentity(event.target.value)
                }
                className="max-w-28 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-xs text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                {context.developmentIdentity.identities.map((identity) => (
                  <option key={identity.id} value={identity.id}>
                    Dev: {identity.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="hidden items-center gap-2 md:flex">
            <Avatar
              id={context.session.user.id}
              name={context.session.user.display_name}
            />
            <span className="max-w-28 truncate text-xs text-slate-300">
              {context.session.user.display_name}
            </span>
            <button
              type="button"
              onClick={() => void context.logout()}
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Log out
            </button>
          </div>
          <button
            className="rounded p-1.5 text-slate-400 hover:bg-white/5 md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {mobileOpen && (
          <div className="border-t border-white/[0.06] px-4 py-3 md:hidden">
            <div className="grid gap-1">
              {nav.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                      isActive
                        ? "bg-indigo-600/20 text-indigo-400"
                        : "text-slate-400"
                    }`
                  }
                >
                  <Icon size={15} /> {label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>
      <main className="min-h-[calc(100vh-3.5rem)]">
        <Routes>
          <Route path="/" element={<DashboardPage context={context} />} />
          <Route
            path="/applications"
            element={<ApplicationsPage context={context} />}
          />
          <Route
            path="/applications/new"
            element={<ApplicationFormPage context={context} mode="create" />}
          />
          <Route
            path="/applications/:applicationId"
            element={<ApplicationDetailPage context={context} />}
          />
          <Route
            path="/applications/:applicationId/edit"
            element={<ApplicationFormPage context={context} mode="edit" />}
          />
          <Route path="/deleted" element={<DeletedPage context={context} />} />
          <Route
            path="/workspace"
            element={<WorkspacePage context={context} />}
          />
          <Route path="/profile" element={<ProfilePage context={context} />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}

function DashboardPage({ context }: { context: AppContext }) {
  const [summary, setSummary] = useState<ApplicationSummary | null>(null);
  const [deletedCount, setDeletedCount] = useState(0);
  const [teamStats, setTeamStats] = useState<
    {
      owner: ApplicationSummary["by_owner"][number]["owner"];
      active: number;
      thisWeek: number;
      rejected: number;
      lastApplied: string | null;
    }[]
  >([]);
  const [showWorkspaceIntro, setShowWorkspaceIntro] = useState(
    () =>
      window.localStorage.getItem(
        "applytogether.dashboardIntroDismissed",
      ) !== "true",
  );
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const summaryResponse = await applicationsApi.summary(
        context.client,
        context.session.workspace.id,
      );
      const latestWeek =
        summaryResponse.applications_over_time.at(-1)?.by_owner ?? [];
      const [deletedResponse, ...ownerDetails] = await Promise.all([
        applicationsApi.deleted(
          context.client,
          context.session.workspace.id,
          1,
          1,
        ),
        ...summaryResponse.by_owner.map(async (ownerCount) => {
          const [rejected, latest] = await Promise.all([
            applicationsApi.list(
              context.client,
              context.session.workspace.id,
              {
                ...defaultFilters,
                ownerId: ownerCount.owner.id,
                status: "rejected",
                pageSize: 1,
              },
            ),
            applicationsApi.list(
              context.client,
              context.session.workspace.id,
              {
                ...defaultFilters,
                ownerId: ownerCount.owner.id,
                sortBy: "application_date",
                sortOrder: "desc",
                pageSize: 1,
              },
            ),
          ]);
          return {
            owner: ownerCount.owner,
            active: ownerCount.count,
            thisWeek:
              latestWeek.find(
                (item) => item.owner.id === ownerCount.owner.id,
              )?.count ?? 0,
            rejected: rejected.pagination.total_items,
            lastApplied: latest.items[0]?.application_date ?? null,
          };
        }),
      ]);
      setSummary(summaryResponse);
      setDeletedCount(deletedResponse.pagination.total_items);
      setTeamStats(ownerDetails);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [context.client, context.session.workspace.id]);

  useEffect(() => void load(), [load]);

  if (loading) return <LoadingState label="Loading dashboard…" />;
  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <ErrorState error={error} onRetry={load} />
      </div>
    );
  }

  const counts = summary?.by_owner ?? [];
  const ownerColors = ["#6366f1", "#10b981", "#f59e0b", "#38bdf8"];
  const ownerKeys = counts.map((_item, index) => `owner_${index}`);
  const applicationsOverTime = (summary?.applications_over_time ?? []).map(
    (point) => {
      const row: Record<string, string | number> = {
        week: formatWeekRange(point.week_start),
      };
      counts.forEach((ownerCount, index) => {
        row[ownerKeys[index]] =
          point.by_owner.find(
            (item) => item.owner.id === ownerCount.owner.id,
          )?.count ?? 0;
      });
      return row;
    },
  );
  const applicationsByUser = counts.map((item) => ({
    name: item.owner.display_name,
    count: item.count,
  }));
  const statusMix = (Object.keys(statusLabels) as ApplicationStatus[]).map(
    (status) => ({
      name: statusLabels[status],
      value: summary?.status_counts[status] ?? 0,
      color: {
        applied: "#3b82f6",
        rejected: "#ef4444",
        withdrawn: "#64748b",
        closed: "#f59e0b",
      }[status],
    }),
  );
  const arrangementMix = (
    Object.keys(arrangementLabels) as WorkArrangement[]
  ).map((arrangement) => ({
    name: arrangementLabels[arrangement],
    value: summary?.work_arrangement_counts[arrangement] ?? 0,
    color: {
      remote: "#10b981",
      hybrid: "#6366f1",
      onsite: "#94a3b8",
      unknown: "#475569",
    }[arrangement],
  }));
  const applicationsThisWeek = teamStats.reduce(
    (total, item) => total + item.thisWeek,
    0,
  );

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6">
      {showWorkspaceIntro && (
        <section className="relative mb-5 overflow-hidden rounded-2xl border border-indigo-500/20 bg-[linear-gradient(115deg,rgba(49,46,129,0.42),rgba(17,24,39,0.97)_58%)] px-7 py-9 sm:px-10">
          <button
            onClick={() => {
              window.localStorage.setItem(
                "applytogether.dashboardIntroDismissed",
                "true",
              );
              setShowWorkspaceIntro(false);
            }}
            className="absolute right-4 top-4 rounded p-1 text-indigo-300/60 transition hover:bg-white/5 hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            aria-label="Dismiss workspace introduction"
          >
            <X size={13} />
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-400">
            Shared workspace · {context.session.workspace.name}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Track applications together
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#90acd1] sm:text-lg">
            A shared workspace for logging jobs, staying accountable, and
            keeping visibility across the search.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/applications/new">
              <PrimaryButton>
                <Plus size={16} /> Add application
              </PrimaryButton>
            </Link>
            <Link
              to="/applications"
              className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.045] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
            >
              View applications
            </Link>
          </div>
        </section>
      )}

      <div className="mb-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardMetricCard
          label="Total active applications"
          value={summary?.total_active ?? 0}
          color="text-indigo-400"
          icon={<FileText size={18} />}
          iconClass="bg-indigo-500/10 text-indigo-400"
        />
        <DashboardMetricCard
          label="Applications this week"
          value={applicationsThisWeek}
          color="text-emerald-400"
          icon={<TrendingUp size={18} />}
          iconClass="bg-emerald-500/10 text-emerald-400"
        />
        <DashboardMetricCard
          label="Recently updated"
          value={summary?.recently_updated ?? 0}
          color="text-blue-400"
          icon={<Clock3 size={18} />}
          iconClass="bg-blue-500/10 text-blue-400"
        />
        <DashboardMetricCard
          label="My deleted applications"
          value={deletedCount}
          color="text-amber-400"
          icon={<Trash size={18} />}
          iconClass="bg-amber-500/10 text-amber-400"
        />
      </div>

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#8da8ca]">
          Team accountability
        </h2>
        <div className="grid gap-5 lg:grid-cols-2">
          {teamStats.map((item) => {
            const weeklyShare =
              applicationsThisWeek === 0
                ? 0
                : Math.round((item.thisWeek / applicationsThisWeek) * 100);
            const isCurrentUser = item.owner.id === context.session.user.id;
            return (
              <article
                key={item.owner.id}
                className={`rounded-2xl border bg-[#111827] p-6 ${
                  isCurrentUser
                    ? "border-indigo-500/35"
                    : "border-white/[0.09]"
                }`}
              >
                <div className="flex items-start gap-4">
                  <Avatar
                    id={item.owner.id}
                    name={item.owner.display_name}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-white">
                        {item.owner.display_name}
                      </h3>
                      {isCurrentUser && (
                        <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs text-indigo-400">
                          You
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-3 text-center">
                  <AccountabilityStat
                    value={item.active}
                    label="Active"
                    color="text-white"
                  />
                  <AccountabilityStat
                    value={item.thisWeek}
                    label="This week"
                    color="text-emerald-400"
                  />
                  <AccountabilityStat
                    value={item.rejected}
                    label="Rejected"
                    color="text-red-400"
                  />
                </div>
                <div className="mt-6 border-t border-white/[0.06] pt-5">
                  <div className="flex justify-between text-xs text-[#486585]">
                    <span>Weekly share</span>
                    <span>{weeklyShare}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-[width]"
                      style={{ width: `${weeklyShare}%` }}
                    />
                  </div>
                  <p className="mt-4 text-xs text-[#405b7d]">
                    Last applied:{" "}
                    <span className="text-[#607fa4]">
                      {item.lastApplied
                        ? formatDate(item.lastApplied)
                        : "No applications yet"}
                    </span>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-[#8da8ca]">
        Analytics
      </h2>
      <div className="grid gap-5 lg:grid-cols-2">
        <DashboardChartCard title="Applications over time">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={applicationsOverTime}
              margin={{ top: 14, right: 8, left: -20, bottom: 4 }}
            >
              <CartesianGrid
                stroke="rgba(148,163,184,0.08)"
                strokeDasharray="3 4"
                vertical={false}
              />
              <XAxis
                dataKey="week"
                interval={0}
                angle={-26}
                textAnchor="end"
                height={58}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#49617f", fontSize: 10 }}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#49617f", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                itemStyle={{ color: "#e2e8f0" }}
                labelStyle={{ color: "#9fb6d4" }}
                cursor={{ fill: "rgba(99,102,241,0.06)" }}
              />
              {ownerKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={counts[index]?.owner.display_name}
                  fill={ownerColors[index % ownerColors.length]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={16}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <ChartLegend
            items={counts.map((item, index) => ({
              label: item.owner.display_name,
              color: ownerColors[index % ownerColors.length],
            }))}
          />
        </DashboardChartCard>

        <DashboardChartCard title="Applications by user">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={applicationsByUser}
              layout="vertical"
              margin={{ top: 14, right: 8, left: 4, bottom: 4 }}
            >
              <CartesianGrid
                stroke="rgba(148,163,184,0.08)"
                strokeDasharray="3 4"
                horizontal={false}
              />
              <XAxis
                type="number"
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#49617f", fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={92}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#9eb6d4", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                itemStyle={{ color: "#e2e8f0" }}
                labelStyle={{ color: "#9fb6d4" }}
                cursor={{ fill: "rgba(99,102,241,0.06)" }}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </DashboardChartCard>

        <DashboardDonutCard title="Status mix" data={statusMix} />
        <DashboardDonutCard
          title="Work arrangement mix"
          data={arrangementMix}
        />
      </div>

      <section className="mt-7">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#8da8ca]">
          Recent activity
        </h2>
        <div className="divide-y divide-white/[0.055] overflow-hidden rounded-xl border border-white/[0.09] bg-[#111827]">
          {(summary?.recent_activity ?? []).length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              Activity will appear after applications are added or updated.
            </div>
          ) : (
            summary?.recent_activity.map((activity) => (
              <Link
                key={`${activity.application_id}-${activity.occurred_at}`}
                to={`/applications/${activity.application_id}`}
                className="flex min-h-20 items-center gap-4 px-6 py-4 transition-colors hover:bg-white/[0.025]"
              >
                <Avatar
                  id={activity.owner.id}
                  name={activity.owner.display_name}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#a9bdd6]">
                    <span className="font-semibold text-slate-100">
                      {activity.owner.display_name}
                    </span>{" "}
                    <span className="text-[#597394]">{activity.action}</span>{" "}
                    <span className="font-medium text-slate-100">
                      {activity.job_title}
                    </span>{" "}
                    <span className="text-[#425b7b]">
                      at {activity.company_name}
                    </span>
                    {activity.action === "updated" && (
                      <span className="ml-2">
                        <StatusPill status={activity.status} />
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-[#425b7b]">
                    {formatRelativeTime(activity.occurred_at)}
                  </p>
                </div>
                <span
                  className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                    activity.action === "added"
                      ? "bg-emerald-500"
                      : activity.status === "rejected"
                        ? "bg-red-500"
                        : activity.status === "closed"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                  }`}
                  aria-hidden="true"
                />
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

const chartTooltipStyle = {
  background: "#151e2f",
  border: "1px solid rgba(148,163,184,0.16)",
  borderRadius: "8px",
  color: "#e2e8f0",
  fontSize: "12px",
};

function DashboardMetricCard({
  label,
  value,
  color,
  icon,
  iconClass,
}: {
  label: string;
  value: number;
  color: string;
  icon: ReactNode;
  iconClass: string;
}) {
  return (
    <article className="rounded-2xl border border-white/[0.09] bg-[#111827] p-5">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}
      >
        {icon}
      </div>
      <p className={`mt-4 text-3xl font-bold tracking-tight ${color}`}>
        {value}
      </p>
      <p className="mt-1 text-sm text-[#587493]">{label}</p>
    </article>
  );
}

function AccountabilityStat({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-[#405b7d]">{label}</p>
    </div>
  );
}

function DashboardChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="relative h-[355px] rounded-2xl border border-white/[0.09] bg-[#111827] p-6 pb-12">
      <h2 className="mb-3 text-base font-semibold text-slate-100">{title}</h2>
      <div className="h-[255px]">{children}</div>
    </section>
  );
}

function ChartLegend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <div className="absolute bottom-6 left-6 flex flex-wrap gap-x-6 gap-y-2">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-2 text-xs text-[#557191]"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function DashboardDonutCard({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number; color: string }[];
}) {
  return (
    <section className="h-[260px] rounded-2xl border border-white/[0.09] bg-[#111827] p-6">
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      <div className="mt-3 grid h-[180px] grid-cols-[170px_1fr] items-center gap-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={46}
              outerRadius={70}
              stroke="none"
              strokeWidth={0}
            >
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0];
                return (
                  <div className="rounded-lg border border-white/10 bg-[#151e2f] px-3 py-2 shadow-xl">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            typeof item.payload?.color === "string"
                              ? item.payload.color
                              : "#6366f1",
                        }}
                      />
                      <span className="text-[#9fb6d4]">{item.name}</span>
                      <strong className="text-white">{item.value}</strong>
                    </div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-3">
          {data.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="inline-flex items-center gap-2 text-[#597394]">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.name}
              </span>
              <span className="font-semibold text-slate-100">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatRelativeTime(value: string): string {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (elapsedSeconds < 60) return "Just now";
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function filtersFromSearchParams(params: URLSearchParams): ApplicationFilters {
  const page = Number(params.get("page") ?? "1");
  const pageSize = Number(params.get("page_size") ?? "10");
  return {
    search: params.get("search") ?? "",
    ownerId: params.get("owner_id") ?? "",
    status: (params.get("status") as ApplicationStatus | null) ?? "",
    workArrangement:
      (params.get("work_arrangement") as WorkArrangement | null) ?? "",
    employmentType:
      (params.get("employment_type") as EmploymentType | null) ?? "",
    sortBy:
      (params.get("sort_by") as SortField | null) ?? "application_date",
    sortOrder:
      params.get("sort_order") === "asc" ? "asc" : "desc",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: [10, 20, 50].includes(pageSize) ? pageSize : 10,
  };
}

function searchParamsFromFilters(filters: ApplicationFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.ownerId) params.set("owner_id", filters.ownerId);
  if (filters.status) params.set("status", filters.status);
  if (filters.workArrangement)
    params.set("work_arrangement", filters.workArrangement);
  if (filters.employmentType)
    params.set("employment_type", filters.employmentType);
  params.set("sort_by", filters.sortBy);
  params.set("sort_order", filters.sortOrder);
  params.set("page", String(filters.page));
  params.set("page_size", String(filters.pageSize));
  return params;
}

function ApplicationsPage({ context }: { context: AppContext }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  );
  const [result, setResult] = useState<PaginatedApplications | null>(null);
  const [summary, setSummary] = useState<ApplicationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [list, nextSummary] = await Promise.all([
        applicationsApi.list(
          context.client,
          context.session.workspace.id,
          filters,
        ),
        applicationsApi.summary(context.client, context.session.workspace.id),
      ]);
      setResult(list);
      setSummary(nextSummary);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [context.client, context.session.workspace.id, filters]);

  useEffect(() => void load(), [load]);

  const update = (changes: Partial<ApplicationFilters>, resetPage = true) => {
    setSearchParams(
      searchParamsFromFilters({
        ...filters,
        ...changes,
        page: resetPage ? 1 : (changes.page ?? filters.page),
      }),
    );
  };

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6">
      <PageHeader
        title="Applications"
        description="Search and manage the live records in your shared workspace."
        action={
          <Link to="/applications/new">
            <PrimaryButton>
              <Plus size={15} /> Add application
            </PrimaryButton>
          </Link>
        }
      />
      <div className="mb-4 rounded-xl border border-white/[0.08] bg-[#111827] p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <label className="relative lg:col-span-2">
            <span className="sr-only">Search company or job title</span>
            <Search
              className="absolute left-3 top-2.5 text-slate-600"
              size={14}
            />
            <input
              value={filters.search}
              onChange={(event) => update({ search: event.target.value })}
              placeholder="Search company or role"
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-indigo-500/50 focus:outline-none"
            />
          </label>
          <FilterSelect
            label="Owner"
            value={filters.ownerId}
            onChange={(value) => update({ ownerId: value })}
            options={(summary?.by_owner ?? []).map((item) => ({
              value: item.owner.id,
              label: item.owner.display_name,
            }))}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(value) =>
              update({ status: value as ApplicationStatus | "" })
            }
            options={Object.entries(statusLabels).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <FilterSelect
            label="Arrangement"
            value={filters.workArrangement}
            onChange={(value) =>
              update({ workArrangement: value as WorkArrangement | "" })
            }
            options={Object.entries(arrangementLabels).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <FilterSelect
            label="Employment"
            value={filters.employmentType}
            onChange={(value) =>
              update({ employmentType: value as EmploymentType | "" })
            }
            options={Object.entries(employmentLabels).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-3">
          <div className="flex items-center gap-2">
            <ArrowUpDown size={13} className="text-slate-600" />
            <FilterSelect
              label="Sort"
              value={filters.sortBy}
              includeAll={false}
              onChange={(value) => update({ sortBy: value as SortField })}
              options={[
                { value: "application_date", label: "Application date" },
                { value: "updated_at", label: "Last updated" },
                { value: "company_name", label: "Company" },
                { value: "job_title", label: "Job title" },
              ]}
            />
            <button
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              onClick={() =>
                update({
                  sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
                })
              }
            >
              {filters.sortOrder === "asc" ? "Ascending" : "Descending"}
            </button>
          </div>
          <button
            className="text-xs text-slate-500 hover:text-slate-300"
            onClick={() => setSearchParams(searchParamsFromFilters(defaultFilters))}
          >
            Clear filters
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState label="Loading applications…" />
      ) : error ? (
        <ErrorState error={error} onRetry={load} />
      ) : result && result.items.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#111827]">
            <ApplicationTable
              applications={result.items}
              currentUserId={context.session.user.id}
              canModerate={["owner", "admin"].includes(
                context.session.workspace.role,
              )}
              context={context}
              onDelete={load}
            />
          </div>
          <PaginationBar
            pagination={result.pagination}
            onPage={(page) => update({ page }, false)}
            pageSize={filters.pageSize}
            onPageSize={(pageSize) => update({ pageSize })}
          />
        </>
      ) : (
        <EmptyState
          title="No matching applications"
          description="Try clearing a filter, or add an application to this workspace."
          action={
            <Link to="/applications/new">
              <PrimaryButton>Add application</PrimaryButton>
            </Link>
          }
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  includeAll = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  includeAll?: boolean;
}) {
  const selectOptions = [
    ...(includeAll
      ? [{ value: "", label: `All ${label.toLowerCase()}` }]
      : []),
    ...options,
  ];

  return (
    <DarkSelect
      ariaLabel={label}
      value={value}
      onChange={onChange}
      options={selectOptions}
    />
  );
}

function ApplicationTable({
  applications,
  currentUserId,
  canModerate,
  context,
  onDelete,
}: {
  applications: JobApplication[];
  currentUserId: string;
  canModerate: boolean;
  context: AppContext;
  onDelete: () => void;
}) {
  const navigate = useNavigate();

  const remove = async (application: JobApplication) => {
    if (
      !window.confirm(
        `Move ${application.company_name} — ${application.job_title} to Deleted? You can restore it later.`,
      )
    ) {
      return;
    }
    try {
      await applicationsApi.delete(
        context.client,
        context.session.workspace.id,
        application.id,
      );
      toast.success("Application moved to Deleted.");
      onDelete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    }
  };

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-[1180px] w-full">
          <thead className="border-b border-white/[0.065] bg-white/[0.012] text-left text-[11px] uppercase tracking-[0.08em] text-[#607da3]">
            <tr>
              <th className="w-[12%] px-5 py-4 font-semibold">Company</th>
              <th className="w-[21%] px-4 py-4 font-semibold">Role</th>
              <th className="w-[12%] px-4 py-4 font-semibold">Owner</th>
              <th className="w-[14%] px-4 py-4 font-semibold">Location</th>
              <th className="w-[11%] px-4 py-4 font-semibold">Arrangement</th>
              <th className="w-[9%] px-4 py-4 font-semibold">Type</th>
              <th className="w-[10%] px-4 py-4 font-semibold">Status</th>
              <th className="w-[10%] px-4 py-4 font-semibold">Applied</th>
              <th className="px-5 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.055]">
            {applications.map((application) => (
              <tr
                key={application.id}
                className="h-[82px] transition-colors hover:bg-white/[0.018]"
              >
                <td className="px-5 py-4">
                  <a
                    href={application.job_posting_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-100 hover:text-indigo-400"
                  >
                    {application.company_name}
                    <ExternalLink size={11} className="text-[#405878]" />
                  </a>
                </td>
                <td className="px-4 py-4">
                  <Link
                    to={`/applications/${application.id}`}
                    className="text-sm text-[#9bb3d1] hover:text-indigo-400"
                  >
                    {application.job_title}
                  </Link>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2.5 text-xs text-[#607a9b]">
                    <Avatar
                      id={application.owner.id}
                      name={application.owner.display_name}
                    />
                    {application.owner.display_name}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="block max-w-40 truncate text-xs text-[#405b7d]">
                    {application.location}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <ArrangementPill value={application.work_arrangement} />
                </td>
                <td className="px-4 py-4">
                  <EmploymentPill value={application.employment_type} />
                </td>
                <td className="px-4 py-4">
                  <StatusPill status={application.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-xs text-[#486485]">
                  {formatDate(application.application_date)}
                </td>
                <td className="px-5 py-4">
                  <ApplicationActions
                    applicationOwnerId={application.owner.id}
                    canModerate={canModerate}
                    currentUserId={currentUserId}
                    onView={() => navigate(`/applications/${application.id}`)}
                    onEdit={() =>
                      navigate(`/applications/${application.id}/edit`)
                    }
                    onDelete={() => void remove(application)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-white/[0.06] lg:hidden">
        {applications.map((application) => (
          <article key={application.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  to={`/applications/${application.id}`}
                  className="font-medium text-slate-200"
                >
                  {application.company_name}
                </Link>
                <p className="mt-0.5 text-xs text-slate-500">
                  {application.job_title}
                </p>
              </div>
              <StatusPill status={application.status} />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Avatar
                  id={application.owner.id}
                  name={application.owner.display_name}
                />
                {application.owner.display_name}
              </div>
              <ApplicationActions
                applicationOwnerId={application.owner.id}
                canModerate={canModerate}
                currentUserId={currentUserId}
                onView={() => navigate(`/applications/${application.id}`)}
                onEdit={() => navigate(`/applications/${application.id}/edit`)}
                onDelete={() => void remove(application)}
              />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function PaginationBar({
  pagination,
  onPage,
  pageSize,
  onPageSize,
}: {
  pagination: PaginatedApplications["pagination"];
  onPage: (page: number) => void;
  pageSize: number;
  onPageSize?: (size: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-slate-600">
        {pagination.total_items} application
        {pagination.total_items === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Per page</span>
            <div className="w-20">
              <DarkSelect
                ariaLabel="Applications per page"
                value={String(pageSize)}
                onChange={(value) => onPageSize(Number(value))}
                options={[
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                  { value: "50", label: "50" },
                ]}
                className="min-h-7 py-1.5"
              />
            </div>
          </div>
        )}
        <button
          aria-label="Previous page"
          disabled={pagination.page <= 1}
          onClick={() => onPage(pagination.page - 1)}
          className="rounded border border-white/10 p-1.5 text-slate-400 disabled:opacity-30"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs text-slate-500">
          Page {pagination.page} of {Math.max(pagination.total_pages, 1)}
        </span>
        <button
          aria-label="Next page"
          disabled={pagination.page >= pagination.total_pages}
          onClick={() => onPage(pagination.page + 1)}
          className="rounded border border-white/10 p-1.5 text-slate-400 disabled:opacity-30"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function ApplicationDetailPage({ context }: { context: AppContext }) {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState<JobApplication | null>(null);
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setApplication(
        await applicationsApi.get(
          context.client,
          context.session.workspace.id,
          applicationId,
        ),
      );
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [applicationId, context.client, context.session.workspace.id]);

  useEffect(() => void load(), [load]);

  if (loading) return <LoadingState label="Loading application…" />;
  if (error || !application) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <ErrorState error={error ?? new Error("Application was not found.")} />
      </div>
    );
  }

  const owned = application.owner.id === context.session.user.id;
  const canModerate = ["owner", "admin"].includes(
    context.session.workspace.role,
  );
  const remove = async () => {
    if (!window.confirm("Move this application to Deleted?")) return;
    try {
      await applicationsApi.delete(
        context.client,
        context.session.workspace.id,
        application.id,
      );
      toast.success("Application moved to Deleted.");
      navigate("/applications");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Delete failed.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        to="/applications"
        className="mb-6 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
      >
        <ArrowLeft size={12} /> Applications
      </Link>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              {application.company_name}
            </h1>
            <StatusPill status={application.status} />
          </div>
          <p className="mt-1 text-slate-500">{application.job_title}</p>
        </div>
        {(owned || canModerate) && (
          <div className="flex gap-2">
            {owned && (
              <Link to={`/applications/${application.id}/edit`}>
                <PrimaryButton>Edit application</PrimaryButton>
              </Link>
            )}
            <button
              className="rounded-lg border border-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
              onClick={() => void remove()}
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {!owned && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-indigo-500/15 bg-indigo-500/5 p-4 text-sm text-slate-400">
          <Shield size={15} className="mt-0.5 flex-shrink-0 text-indigo-400" />
          <span>
            This record belongs to {application.owner.display_name}. You can
            view it but cannot edit it.
            {canModerate &&
              " As a workspace owner, you may remove it if it does not belong in this workspace."}
          </span>
        </div>
      )}
      <div className="space-y-4">
        <DetailCard
          title="Application"
          items={[
            ["Owner", application.owner.display_name],
            ["Location", application.location],
            ["Work arrangement", arrangementLabels[application.work_arrangement]],
            ["Employment type", employmentLabels[application.employment_type]],
            ["Application date", formatDate(application.application_date)],
            ["Salary", formatSalary(application)],
          ]}
        />
        <DetailCard
          title="Job posting"
          items={[
            [
              "Original posting",
              <a
                key="posting"
                href={application.job_posting_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
              >
                Open posting <ExternalLink size={12} />
              </a>,
            ],
          ]}
        />
        {(application.job_description || application.notes) && (
          <DetailCard
            title="Notes"
            items={[
              ["Job description", application.job_description || "Not provided"],
              ["Personal notes", application.notes || "Not provided"],
            ]}
          />
        )}
      </div>
    </div>
  );
}

function DetailCard({
  title,
  items,
}: {
  title: string;
  items: [string, ReactNode][];
}) {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#111827] p-5">
      <h2 className="mb-4 border-b border-white/[0.06] pb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="mb-1 text-[11px] uppercase tracking-wider text-slate-600">
              {label}
            </dt>
            <dd className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

interface FormValues {
  company_name: string;
  job_title: string;
  job_posting_url: string;
  location: string;
  work_arrangement: WorkArrangement;
  employment_type: EmploymentType;
  application_date: string;
  status: ApplicationStatus;
  salary_min: string;
  salary_max: string;
  salary_currency: string;
  salary_period: SalaryPeriod | "";
  job_description: string;
  notes: string;
}

const emptyForm: FormValues = {
  company_name: "",
  job_title: "",
  job_posting_url: "",
  location: "",
  work_arrangement: "unknown",
  employment_type: "unknown",
  application_date: new Date().toISOString().slice(0, 10),
  status: "applied",
  salary_min: "",
  salary_max: "",
  salary_currency: "USD",
  salary_period: "",
  job_description: "",
  notes: "",
};

function applicationToForm(application: JobApplication): FormValues {
  return {
    company_name: application.company_name,
    job_title: application.job_title,
    job_posting_url: application.job_posting_url,
    location: application.location,
    work_arrangement: application.work_arrangement,
    employment_type: application.employment_type,
    application_date: application.application_date,
    status: application.status,
    salary_min: application.salary_min ?? "",
    salary_max: application.salary_max ?? "",
    salary_currency: application.salary_currency ?? "USD",
    salary_period: application.salary_period ?? "",
    job_description: application.job_description ?? "",
    notes: application.notes ?? "",
  };
}

function ApplicationFormPage({
  context,
  mode,
}: {
  context: AppContext;
  mode: "create" | "edit";
}) {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode !== "edit") return;
    applicationsApi
      .get(context.client, context.session.workspace.id, applicationId)
      .then((application) => {
        if (application.owner.id !== context.session.user.id) {
          throw new Error("Only the application owner may edit this record.");
        }
        setForm(applicationToForm(application));
      })
      .catch((error: unknown) =>
        setFormError(error instanceof Error ? error.message : "Load failed."),
      )
      .finally(() => setLoading(false));
  }, [
    applicationId,
    context.client,
    context.session.user.id,
    context.session.workspace.id,
    mode,
  ]);

  const set = (key: keyof FormValues, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(undefined);
    setFieldErrors({});

    const required: (keyof FormValues)[] = [
      "company_name",
      "job_title",
      "job_posting_url",
      "location",
      "work_arrangement",
      "employment_type",
    ];
    const nextErrors = Object.fromEntries(
      required
        .filter((key) => !form[key].trim())
        .map((key) => [key, "This field is required."]),
    );
    if ((form.salary_min || form.salary_max) && !form.salary_period) {
      nextErrors.salary_period = "Choose a salary period.";
    }
    const salaryMinError = validateSalaryAmount(form.salary_min);
    const salaryMaxError = validateSalaryAmount(form.salary_max);
    if (salaryMinError) nextErrors.salary_min = salaryMinError;
    if (salaryMaxError) nextErrors.salary_max = salaryMaxError;
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setFormError("Review the highlighted fields.");
      return;
    }

    const payload: ApplicationPayload = {
      company_name: form.company_name.trim(),
      job_title: form.job_title.trim(),
      job_posting_url: form.job_posting_url.trim(),
      location: form.location.trim(),
      work_arrangement: form.work_arrangement,
      employment_type: form.employment_type,
      application_date: form.application_date,
      status: form.status,
      salary_min: form.salary_min || null,
      salary_max: form.salary_max || null,
      salary_currency: form.salary_currency || null,
      salary_period: form.salary_period || null,
      job_description: form.job_description.trim() || null,
      notes: form.notes.trim() || null,
    };

    setSubmitting(true);
    try {
      const saved =
        mode === "create"
          ? await applicationsApi.create(
              context.client,
              context.session.workspace.id,
              payload,
            )
          : await applicationsApi.update(
              context.client,
              context.session.workspace.id,
              applicationId,
              payload,
            );
      toast.success(mode === "create" ? "Application saved." : "Changes saved.");
      navigate(`/applications/${saved.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(
          error.code === "deleted_application_exists"
            ? "A deleted application already uses this posting URL. Restore that record from Deleted."
            : error.message,
        );
        setFieldErrors(validationFieldErrors(error.details));
      } else {
        setFormError(error instanceof Error ? error.message : "Save failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading form…" />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
      >
        <ArrowLeft size={12} /> Back
      </button>
      <PageHeader
        title={mode === "create" ? "Add application" : "Edit application"}
        description={
          mode === "create"
            ? "Record a job you applied to. Ownership is assigned by the backend."
            : "Update the fields on your application record."
        }
      />
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300"
          >
            {formError}
          </div>
        )}
        <FormSection title="Role">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Company name"
              name="company_name"
              value={form.company_name}
              error={fieldErrors.company_name}
              onChange={(value) => set("company_name", value)}
              required
            />
            <FormField
              label="Job title"
              name="job_title"
              value={form.job_title}
              error={fieldErrors.job_title}
              onChange={(value) => set("job_title", value)}
              required
            />
            <FormField
              label="Job-posting URL"
              name="job_posting_url"
              type="url"
              value={form.job_posting_url}
              error={fieldErrors.job_posting_url}
              onChange={(value) => set("job_posting_url", value)}
              required
              wide
            />
            <FormField
              label="Location"
              name="location"
              value={form.location}
              error={fieldErrors.location}
              onChange={(value) => set("location", value)}
              required
            />
            <FormSelect
              label="Work arrangement"
              name="work_arrangement"
              value={form.work_arrangement}
              onChange={(value) =>
                set("work_arrangement", value as WorkArrangement)
              }
              options={Object.entries(arrangementLabels)}
            />
            <FormSelect
              label="Employment type"
              name="employment_type"
              value={form.employment_type}
              onChange={(value) =>
                set("employment_type", value as EmploymentType)
              }
              options={Object.entries(employmentLabels)}
            />
            <FormField
              label="Application date"
              name="application_date"
              type="date"
              value={form.application_date}
              onChange={(value) => set("application_date", value)}
              required
            />
            <FormSelect
              label="Status"
              name="status"
              value={form.status}
              onChange={(value) => set("status", value as ApplicationStatus)}
              options={Object.entries(statusLabels)}
            />
          </div>
        </FormSection>
        <FormSection title="Salary">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              label="Minimum"
              name="salary_min"
              type="number"
              max={MAX_SALARY_AMOUNT}
              value={form.salary_min}
              error={fieldErrors.salary_min}
              onChange={(value) => set("salary_min", value)}
            />
            <FormField
              label="Maximum"
              name="salary_max"
              type="number"
              max={MAX_SALARY_AMOUNT}
              value={form.salary_max}
              error={fieldErrors.salary_max}
              onChange={(value) => set("salary_max", value)}
            />
            <FormField
              label="Currency"
              name="salary_currency"
              value={form.salary_currency}
              error={fieldErrors.salary_currency}
              onChange={(value) => set("salary_currency", value.toUpperCase())}
            />
            <FormSelect
              label="Period"
              name="salary_period"
              value={form.salary_period}
              error={fieldErrors.salary_period}
              onChange={(value) => set("salary_period", value)}
              options={[
                ["", "Not specified"],
                ["hourly", "Hourly"],
                ["monthly", "Monthly"],
                ["yearly", "Yearly"],
              ]}
            />
          </div>
        </FormSection>
        <FormSection title="Context">
          <div className="grid gap-4">
            <FormTextarea
              label="Job description"
              name="job_description"
              value={form.job_description}
              onChange={(value) => set("job_description", value)}
            />
            <FormTextarea
              label="Notes"
              name="notes"
              value={form.notes}
              onChange={(value) => set("notes", value)}
            />
          </div>
        </FormSection>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 hover:bg-white/5"
          >
            Cancel
          </button>
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting && <LoaderCircle className="animate-spin" size={14} />}
            {mode === "create" ? "Save application" : "Save changes"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

function validationFieldErrors(details: unknown): Record<string, string> {
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(
    details.flatMap((detail) => {
      if (typeof detail !== "object" || detail === null) return [];
      const location = "loc" in detail && Array.isArray(detail.loc) ? detail.loc : [];
      const field = location.at(-1);
      const message = "msg" in detail ? String(detail.msg) : "Invalid value.";
      return typeof field === "string" ? [[field, message]] : [];
    }),
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#111827] p-6">
      <h2 className="mb-5 border-b border-white/[0.06] pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  error,
  required,
  wide,
  max,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  error?: string;
  required?: boolean;
  wide?: boolean;
  max?: number;
}) {
  const errorId = `${name}-error`;
  return (
    <label className={wide ? "sm:col-span-2" : ""} htmlFor={name}>
      <span className="mb-1.5 block text-xs font-medium text-slate-400">
        {label} {required && <span className="text-red-400">*</span>}
      </span>
      <input
        id={name}
        name={name}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
        max={max}
        value={value}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-lg border bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none ${
          error
            ? "border-red-500/50 focus:border-red-400"
            : "border-white/10 focus:border-indigo-500/50"
        }`}
      />
      {error && (
        <span id={errorId} className="mt-1 block text-xs text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}

function FormSelect({
  label,
  name,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  error?: string;
}) {
  return (
    <label htmlFor={name}>
      <span className="mb-1.5 block text-xs font-medium text-slate-400">
        {label}
      </span>
      <DarkSelect
        ariaLabel={label}
        value={value}
        onChange={onChange}
        options={options.map(([optionValue, optionLabel]) => ({
          value: optionValue,
          label: optionLabel,
        }))}
        className={error ? "border-red-500/40" : ""}
      />
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}

function FormTextarea({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={name}>
      <span className="mb-1.5 block text-xs font-medium text-slate-400">
        {label}
      </span>
      <textarea
        id={name}
        rows={5}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm leading-relaxed text-slate-200 focus:border-indigo-500/50 focus:outline-none"
      />
    </label>
  );
}

function DeletedPage({ context }: { context: AppContext }) {
  const [page, setPage] = useState(1);
  const [result, setResult] =
    useState<PaginatedApplications<DeletedApplication> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(
        await applicationsApi.deleted(
          context.client,
          context.session.workspace.id,
          page,
          10,
        ),
      );
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [context.client, context.session.workspace.id, page]);

  useEffect(() => void load(), [load]);

  const restore = async (application: DeletedApplication) => {
    try {
      await applicationsApi.restore(
        context.client,
        context.session.workspace.id,
        application.id,
      );
      toast.success(`${application.company_name} restored.`);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Restore failed.");
    }
  };

  const leaveSelectionMode = () => {
    setSelecting(false);
    setSelectedIds(new Set());
    setSelectAll(false);
  };

  const toggleApplication = (applicationId: string) => {
    setSelectAll(false);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(applicationId)) {
        next.delete(applicationId);
      } else {
        next.add(applicationId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectAll(false);
      setSelectedIds(new Set());
      return;
    }
    setSelectAll(true);
    setSelectedIds(new Set(result?.items.map((application) => application.id)));
  };

  const permanentlyDelete = async () => {
    const count = selectAll
      ? (result?.pagination.total_items ?? 0)
      : selectedIds.size;
    if (count === 0) return;
    const noun = count === 1 ? "application" : "applications";
    if (
      !window.confirm(
        `Permanently delete ${count} ${noun}? This cannot be undone or restored.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const response = await applicationsApi.permanentlyDelete(
        context.client,
        context.session.workspace.id,
        selectAll ? [] : [...selectedIds],
        selectAll,
      );
      toast.success(
        `${response.deleted_count} ${
          response.deleted_count === 1 ? "application" : "applications"
        } permanently deleted.`,
      );
      leaveSelectionMode();
      if (page !== 1) {
        setPage(1);
      } else {
        await load();
      }
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Permanent deletion failed.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Deleted applications"
        description="Review, restore, or permanently erase applications you deleted."
        action={
          result && result.pagination.total_items > 0 && !selecting ? (
            <button
              onClick={() => setSelecting(true)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3.5 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
            >
              <Trash size={14} /> Permanently delete
            </button>
          ) : undefined
        }
      />
      {selecting && result && (
        <div className="mb-4 flex flex-col justify-between gap-3 rounded-xl border border-red-500/20 bg-gradient-to-r from-red-500/[0.08] to-transparent p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-slate-200">
              Select applications to delete forever
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {selectAll
                ? `All ${result.pagination.total_items} applications in your Deleted tab are selected.`
                : `${selectedIds.size} selected. You can still cancel or restore applications later.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.08]"
            >
              {selectAll ? "Clear all" : "Select all"}
            </button>
            <button
              onClick={leaveSelectionMode}
              className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              disabled={deleting || (!selectAll && selectedIds.size === 0)}
              onClick={() => void permanentlyDelete()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <Trash size={13} />
              )}
              Delete permanently
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <LoadingState label="Loading deleted applications…" />
      ) : error ? (
        <ErrorState error={error} onRetry={load} />
      ) : result && result.items.length > 0 ? (
        <>
          <div className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08] bg-[#111827]">
            {result.items.map((application) => (
              <div
                key={application.id}
                className={`flex flex-col justify-between gap-4 p-5 transition-colors sm:flex-row sm:items-center ${
                  selecting &&
                  (selectAll || selectedIds.has(application.id))
                    ? "bg-red-500/[0.045]"
                    : ""
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  {selecting && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${application.company_name} ${application.job_title}`}
                      checked={selectAll || selectedIds.has(application.id)}
                      onChange={() => toggleApplication(application.id)}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-white/15 bg-[#0b1220] accent-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                    />
                  )}
                  <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-300">
                      {application.company_name}
                    </h2>
                    <StatusPill status={application.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {application.job_title} · Deleted{" "}
                    {formatDate(application.deleted_at)} by{" "}
                    {application.deleted_by.display_name}
                    {application.moderated ? " · Moderated" : ""}
                  </p>
                  </div>
                </div>
                {!selecting && (
                  <button
                    onClick={() => void restore(application)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
                  >
                    <RotateCcw size={13} /> Restore application
                  </button>
                )}
              </div>
            ))}
          </div>
          <PaginationBar
            pagination={result.pagination}
            pageSize={10}
            onPage={setPage}
          />
        </>
      ) : (
        <EmptyState
          title="Deleted is empty"
          description="Applications you remove can be restored from this page."
        />
      )}
    </div>
  );
}

function WorkspacePage({ context }: { context: AppContext }) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [showCreate, setShowCreate] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const isOwner = context.session.workspace.role === "owner";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [memberResponse, invitationResponse] = await Promise.all([
        workspaceApi.members(
          context.client,
          context.session.workspace.id,
        ),
        isOwner
          ? workspaceApi.invitations(
              context.client,
              context.session.workspace.id,
            )
          : Promise.resolve({ items: [] }),
      ]);
      setMembers(memberResponse.items);
      setInvitations(invitationResponse.items);
      setError(undefined);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [context.client, context.session.workspace.id, isOwner]);

  useEffect(() => void load(), [load]);

  const createWorkspace = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspaceName.trim()) return;
    setCreating(true);
    try {
      const workspace = await workspaceApi.create(
        context.client,
        workspaceName,
      );
      await context.refreshWorkspaces();
      context.switchWorkspace(workspace);
      setWorkspaceName("");
      setShowCreate(false);
      toast.success(`${workspace.name} created.`);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Workspace creation failed.",
      );
    } finally {
      setCreating(false);
    }
  };

  const inviteGuest = async (event: FormEvent) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const invitation = await workspaceApi.invite(
        context.client,
        context.session.workspace.id,
        inviteEmail,
      );
      setInviteEmail("");
      await load();
      toast.success(
        invitation.status === "joined"
          ? `${invitation.email} joined the workspace.`
          : `Invitation saved for ${invitation.email}.`,
      );
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Invitation failed.",
      );
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (member: WorkspaceMember) => {
    if (
      !window.confirm(
        `Remove ${member.user.display_name} from ${context.session.workspace.name}? They will immediately lose access to this workspace.`,
      )
    ) {
      return;
    }
    try {
      await workspaceApi.removeMember(
        context.client,
        context.session.workspace.id,
        member.user.id,
      );
      toast.success(`${member.user.display_name} removed from the workspace.`);
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Removal failed.");
    }
  };

  const updateMemberRole = async (
    member: WorkspaceMember,
    role: "admin" | "member",
  ) => {
    try {
      await workspaceApi.updateMemberRole(
        context.client,
        context.session.workspace.id,
        member.user.id,
        role,
      );
      toast.success(
        role === "admin"
          ? `${member.user.display_name} can now moderate applications.`
          : `${member.user.display_name} is now a general member.`,
      );
      await load();
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Role update failed.",
      );
    }
  };

  const deleteWorkspace = async () => {
    if (
      !window.confirm(
        `Delete ${context.session.workspace.name}? Everyone will lose access. Existing records will be retained for administrative recovery.`,
      )
    ) {
      return;
    }
    try {
      await workspaceApi.delete(
        context.client,
        context.session.workspace.id,
      );
      const remaining = await context.refreshWorkspaces();
      const nextWorkspace = remaining[0];
      if (nextWorkspace) context.switchWorkspace(nextWorkspace);
      toast.success("Workspace deleted.");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Workspace deletion failed.",
      );
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Workspace"
        description="Your shared workspace settings and members."
        action={
          <button
            onClick={() => setShowCreate((visible) => !visible)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            <Plus size={14} /> Create workspace
          </button>
        }
      />
      {showCreate && (
        <form
          onSubmit={(event) => void createWorkspace(event)}
          className="mb-4 grid gap-4 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.09] to-[#111827] p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/15 text-indigo-300">
            <Building2 size={19} />
          </div>
          <label className="min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-slate-200">
              Name your new workspace
            </span>
            <input
              autoFocus
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              maxLength={200}
              placeholder="Example: Product search"
              className="w-full rounded-lg border border-white/10 bg-[#0d1424] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-700 focus:border-indigo-500/50 focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-2 sm:self-end">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              disabled={creating || !workspaceName.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              {creating && <LoaderCircle size={13} className="animate-spin" />}
              Create
            </button>
          </div>
        </form>
      )}
      <section className="rounded-2xl border border-white/[0.09] bg-[#111827] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-950/30">
            <Briefcase size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {context.session.workspace.name}
            </h2>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="inline-flex rounded border border-indigo-500/25 bg-indigo-500/15 px-2 py-0.5 text-[11px] font-medium capitalize text-indigo-300">
                {context.session.workspace.role}
              </span>
              <span className="text-xs text-slate-600">
                Your role in this workspace
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-white/[0.07] pt-5">
          <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6f8db4]">
                Members
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                {members.length} active{" "}
                {members.length === 1 ? "member" : "members"}
              </p>
            </div>
            {isOwner && (
              <form
                onSubmit={(event) => void inviteGuest(event)}
                className="flex w-full gap-2 sm:w-auto"
              >
                <label className="relative min-w-0 flex-1 sm:w-64">
                  <Mail
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                  />
                  <span className="sr-only">Guest email</span>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="guest@example.com"
                    className="w-full rounded-lg border border-white/10 bg-[#0d1424] py-2 pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-700 focus:border-indigo-500/50 focus:outline-none"
                  />
                </label>
                <button
                  disabled={inviting || !inviteEmail.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/15 disabled:opacity-40"
                >
                  {inviting ? (
                    <LoaderCircle size={13} className="animate-spin" />
                  ) : (
                    <UserPlus size={13} />
                  )}
                  Invite
                </button>
              </form>
            )}
          </div>
          {loading ? (
            <LoadingState label="Loading workspace members..." />
          ) : error ? (
            <ErrorState error={error} onRetry={load} />
          ) : (
            <div className="space-y-2">
              {members.map((member) => {
                const isCurrentUser =
                  member.user.id === context.session.user.id;
                const canManage = isOwner && member.role !== "owner";
                return (
                  <div
                    key={member.user.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.018] px-4 py-3 transition-colors hover:border-white/[0.11] hover:bg-white/[0.028]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        id={member.user.id}
                        name={member.user.display_name}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-slate-200">
                            {member.user.display_name}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[11px] font-medium text-indigo-400">
                              (You)
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-[#405b7d]">
                          {member.user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canManage ? (
                        <div className="w-28">
                          <DarkSelect
                            ariaLabel={`${member.user.display_name} workspace role`}
                            value={member.role}
                            onChange={(role) =>
                              void updateMemberRole(
                                member,
                                role as "admin" | "member",
                              )
                            }
                            options={[
                              { value: "member", label: "Member" },
                              { value: "admin", label: "Admin" },
                            ]}
                            className="min-h-7 py-1.5"
                          />
                        </div>
                      ) : (
                        <span className="rounded-md border border-white/[0.09] bg-[#1a2436] px-2 py-1 text-[11px] font-medium capitalize text-[#8da7c8]">
                          {member.role}
                        </span>
                      )}
                      {canManage && (
                        <button
                          onClick={() => void removeMember(member)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/15 px-2.5 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
                        >
                          <UserMinus size={12} /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-amber-500/15 bg-amber-500/[0.025] px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                      <Mail size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-300">
                        {invitation.email}
                      </p>
                      <p className="text-xs text-slate-600">
                        Waiting for account onboarding
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md border border-amber-500/15 bg-amber-500/[0.06] px-2 py-1 text-[11px] font-medium text-amber-400">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-start gap-3 border-t border-white/[0.06] pt-5 text-sm leading-relaxed text-[#587392]">
          <Shield size={15} className="mt-0.5 flex-shrink-0" />
          <p>
            {isOwner
              ? "Owners manage workspace access, assign admins, moderate applications, and can delete the workspace. Admins may remove unrelated applications, but cannot manage members or delete the workspace."
              : context.session.workspace.role === "admin"
                ? "Admins may remove applications that do not belong in the workspace. Workspace membership, invitations, and workspace deletion remain owner-only."
                : "Members may add applications, view everyone’s applications, and edit or delete only applications they authored."}
          </p>
        </div>
      </section>

      {isOwner && (
        <section className="mt-4 flex flex-col justify-between gap-4 rounded-2xl border border-red-500/15 bg-red-500/[0.025] p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              Delete workspace
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Removes access for every member. Application records are retained
              for administrative recovery.
            </p>
          </div>
          <button
            onClick={() => void deleteWorkspace()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/15"
          >
            <Trash size={14} /> Delete workspace
          </button>
        </section>
      )}
    </div>
  );
}

function ProfilePage({ context }: { context: AppContext }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const submitPasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(undefined);
    try {
      await context.changePassword({ currentPassword, newPassword });
      toast.success("Password changed. Please sign in again.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The password could not be changed.",
      );
    } finally {
      setCurrentPassword("");
      setNewPassword("");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Profile"
        description="Your account and authentication settings."
      />
      <div className="rounded-xl border border-white/[0.08] bg-[#111827] p-6">
        <div className="flex items-center gap-4 border-b border-white/[0.06] pb-6">
          <Avatar
            id={context.session.user.id}
            name={context.session.user.display_name}
            size="lg"
          />
          <div>
            <h2 className="text-xl font-semibold text-slate-100">
              {context.session.user.display_name}
            </h2>
            <div className="mt-2 flex items-center gap-2 text-xs font-medium text-emerald-400">
              <CheckCircle size={13} /> Signed in
            </div>
          </div>
        </div>
        <form className="mt-6 max-w-md space-y-4" onSubmit={submitPasswordChange}>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Change password</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Changing your password signs this account out on every device.
            </p>
          </div>
          {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
          <label className="block text-sm text-slate-300">
            Current password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0c1120] px-3 py-2 text-sm text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
            />
          </label>
          <label className="block text-sm text-slate-300">
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0c1120] px-3 py-2 text-sm text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
            />
          </label>
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? "Updating password…" : "Update password"}
          </PrimaryButton>
        </form>
        {context.developmentIdentity ? (
          <div className="mt-6 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Shield size={13} /> Developer-only identity adapter
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              This build explicitly enables the development identity header.
              Cookie sessions take precedence in normal builds.
            </p>
            <select
              className="mt-4 w-full rounded-lg border border-white/10 bg-[#171f30] px-3 py-2 text-sm text-slate-300"
              value={context.developmentIdentity.selectedUserId}
              onChange={(event) =>
                context.developmentIdentity?.switchIdentity(event.target.value)
              }
            >
              {context.developmentIdentity.identities.map((identity) => (
                <option key={identity.id} value={identity.id}>
                  Switch to {identity.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <EmptyState
        title="Page not found"
        description="That route does not exist in the ApplyTogether workspace."
        action={
          <Link to="/">
            <PrimaryButton>Return to dashboard</PrimaryButton>
          </Link>
        }
      />
    </div>
  );
}

export function LegacyDevelopmentIdentityApp() {
  const identities = useMemo(configuredDevelopmentIdentities, []);
  const identityStore = useMemo(
    () => createIdentityStore({ identities, storage: window.localStorage }),
    [identities],
  );
  const [selectedUserId, setSelectedUserId] = useState(identityStore.current());
  const [session, setSession] = useState<SessionState | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(Boolean(selectedUserId));
  const [error, setError] = useState<unknown>();

  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000",
        developmentIdentity: { enabled: true, getUserId: () => selectedUserId },
      }),
    [selectedUserId],
  );

  const switchIdentity = (userId: string) => {
    identityStore.select(userId);
    setLoading(true);
    setSelectedUserId(userId);
    setSession(null);
    setWorkspaces([]);
    toast.success(
      `Switched to ${identities.find((identity) => identity.id === userId)?.label ?? "user"}.`,
    );
  };

  const refreshWorkspaces = useCallback(async () => {
    const response = await sessionApi.workspaces(client);
    setWorkspaces(response.items);
    return response.items;
  }, [client]);

  const switchWorkspace = (workspace: Workspace) => {
    if (!session) return;
    window.localStorage.setItem(
      `applytogether.workspace.${selectedUserId}`,
      workspace.id,
    );
    setSession({ ...session, workspace });
    toast.success(`Switched to ${workspace.name}.`);
  };

  useEffect(() => {
    if (!selectedUserId) return;
    let active = true;
    setLoading(true);
    Promise.all([authApi.currentUser(client), authApi.workspaces(client)])
      .then(([user, workspaceResponse]) => {
        if (!active) return;
        setWorkspaces(workspaceResponse.items);
        const preferredWorkspaceId = window.localStorage.getItem(
          `applytogether.workspace.${selectedUserId}`,
        );
        const workspace =
          workspaceResponse.items.find(
            (item) => item.id === preferredWorkspaceId,
          ) ?? workspaceResponse.items[0];
        if (!workspace) {
          throw new Error("This user does not have an active workspace.");
        }
        setSession({ user, workspace });
        setError(undefined);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, selectedUserId]);

  if (!selectedUserId) {
    return <IdentityGate identities={identities} onSelect={switchIdentity} />;
  }
  if (loading) {
    return (
      <div className="dark min-h-screen bg-[#0c1120] text-slate-200">
        <LoadingState label="Discovering your workspace…" />
      </div>
    );
  }
  if (error || !session) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-[#0c1120] p-6 text-slate-200">
        <div className="w-full max-w-lg">
          <ErrorState error={error ?? new Error("Session could not be loaded.")} />
          <button
            className="mt-4 text-sm text-indigo-400"
            onClick={() => {
              identityStore.clear();
              setSelectedUserId(null);
              setError(undefined);
            }}
          >
            Choose another development identity
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      context={{
        client,
        identities,
        selectedUserId,
        session,
        workspaces,
        switchIdentity,
        switchWorkspace,
        refreshWorkspaces,
        logout: async () => undefined,
        changePassword: async () => undefined,
      }}
    />
  );
}

function readCookie(name: string): string | null {
  const encodedName = `${encodeURIComponent(name)}=`;
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(encodedName))
    ?.slice(encodedName.length);
  return value ? decodeURIComponent(value) : null;
}

function AuthenticatedApp({
  client,
  developmentIdentity,
}: {
  client: ApiClient;
  developmentIdentity?: DevelopmentIdentityControls;
}) {
  const auth = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>();

  const refreshWorkspaces = useCallback(async () => {
    const response = await authApi.workspaces(client);
    setWorkspaces(response.items);
    return response.items;
  }, [client]);

  const switchWorkspace = useCallback((workspace: Workspace) => {
    setActiveWorkspaceId(workspace.id);
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated" || !auth.workspace) {
      setWorkspaces([]);
      setActiveWorkspaceId(undefined);
      return;
    }

    void refreshWorkspaces().then((items) => {
      setActiveWorkspaceId((current) =>
        current && items.some((workspace) => workspace.id === current)
          ? current
          : auth.workspace?.id,
      );
    });
  }, [auth.status, auth.workspace, refreshWorkspaces]);

  if (auth.status === "initializing") {
    return (
      <div className="dark min-h-screen bg-[#0c1120] text-slate-200">
        <LoadingState label="Restoring your secure session…" />
      </div>
    );
  }

  if (auth.status === "recoverable-error") {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-[#0c1120] p-6 text-slate-200">
        <div className="w-full max-w-lg">
          <ErrorState
            error={auth.error ?? new Error("Session could not be restored.")}
            onRetry={() => void auth.retry()}
          />
        </div>
      </div>
    );
  }

  if (auth.status === "unauthenticated") {
    return <LoginPage onLogin={auth.login} />;
  }

  if (!auth.user || !auth.workspace) {
  return (
      <div className="dark min-h-screen bg-[#0c1120] text-slate-200">
        <LoadingState label="Loading your workspace…" />
      </div>
    );
  }

  const workspace =
    workspaces.find((item) => item.id === activeWorkspaceId) ?? auth.workspace;
  const availableWorkspaces = workspaces.length > 0 ? workspaces : [auth.workspace];

  return (
    <AppShell
      context={{
        client,
        session: { user: auth.user, workspace },
        workspaces: availableWorkspaces,
        switchWorkspace,
        refreshWorkspaces,
        developmentIdentity,
        logout: async () => {
          try {
            await auth.logout();
          } catch {
            // Clearing the local authenticated state remains intentional when
            // a best-effort server logout cannot complete.
          }
        },
        changePassword: auth.changePassword,
      }}
    />
  );
}

function SecureIntegratedApp() {
  const developmentIdentityEnabled =
    import.meta.env.DEV &&
    import.meta.env.VITE_ENABLE_DEV_IDENTITY_SWITCHER === "true";
  const identities = useMemo(
    () => (developmentIdentityEnabled ? configuredDevelopmentIdentities() : []),
    [developmentIdentityEnabled],
  );
  const identityStore = useMemo(
    () =>
      developmentIdentityEnabled
        ? createIdentityStore({ identities, storage: window.localStorage })
        : null,
    [developmentIdentityEnabled, identities],
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    () => identityStore?.current() ?? null,
  );

  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000",
        csrf: {
          cookieName: import.meta.env.VITE_CSRF_COOKIE_NAME ?? "applytogether_csrf",
          headerName: import.meta.env.VITE_CSRF_HEADER_NAME ?? "X-CSRF-Token",
          readCookie,
        },
        refreshCsrf: {
          cookieName:
            import.meta.env.VITE_REFRESH_CSRF_COOKIE_NAME ??
            "applytogether_refresh_csrf",
          headerName:
            import.meta.env.VITE_REFRESH_CSRF_HEADER_NAME ??
            "X-Refresh-CSRF-Token",
          readCookie,
        },
        developmentIdentity:
          developmentIdentityEnabled && selectedUserId
            ? { enabled: true, getUserId: () => selectedUserId }
            : undefined,
      }),
    [developmentIdentityEnabled, selectedUserId],
  );

  const switchIdentity = (userId: string) => {
    identityStore?.select(userId);
    setSelectedUserId(userId);
    toast.success(
      `Switched developer identity to ${identities.find((identity) => identity.id === userId)?.label ?? "user"}.`,
    );
  };
  const developmentIdentity =
    developmentIdentityEnabled && selectedUserId
      ? { identities, selectedUserId, switchIdentity }
      : undefined;

  return (
    <AuthProvider client={client}>
      <AuthenticatedApp client={client} developmentIdentity={developmentIdentity} />
    </AuthProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#141c2e",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#e2e8f0",
            fontSize: "13px",
          },
        }}
      />
      <SecureIntegratedApp />
    </BrowserRouter>
  );
}
