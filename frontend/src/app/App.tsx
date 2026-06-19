import { useState, useMemo } from "react";
import {
  Plus, ChevronDown, ExternalLink, Eye, Pencil, Trash2,
  RotateCcw, Search, LayoutDashboard, FileText, Trash,
  Users, User, ArrowLeft, Building2, Briefcase,
  DollarSign, Link2, FileCode, StickyNote,
  TrendingUp, Clock, Menu, X, ChevronLeft,
  ChevronRight, Shield, Lock, AlertCircle,
  CheckCircle, Info, ArrowUpDown,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Toaster, toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type Owner = "jonathan" | "kareem";
type AppStatus = "Applied" | "Rejected" | "Withdrawn" | "Closed";
type Arrangement = "Remote" | "Hybrid" | "Onsite" | "Unknown";
type Employment = "Full-time" | "Part-time" | "Contract" | "Internship" | "Temporary" | "Unknown";
type View =
  | "dashboard" | "applications" | "detail" | "add" | "edit"
  | "deleted" | "deleted-detail" | "workspace" | "profile";

interface JobApp {
  id: string;
  company: string;
  role: string;
  owner: Owner;
  location: string;
  arrangement: Arrangement;
  employment: Employment;
  status: AppStatus;
  appliedDate: string;
  updatedDate: string;
  createdDate: string;
  jobUrl: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  jobDescription?: string;
  notes?: string;
}

interface DeletedApp extends JobApp {
  deletedDate: string;
}

interface FormState {
  company: string; role: string; jobUrl: string; location: string;
  arrangement: Arrangement; employment: Employment; status: AppStatus;
  appliedDate: string; salaryMin: string; salaryMax: string;
  salaryCurrency: string; salaryPeriod: string;
  jobDescription: string; notes: string;
}

// ─── Static Data ──────────────────────────────────────────────────────────────

const APPS: JobApp[] = [
  {
    id: "1", company: "Stripe", role: "Strategic Finance Associate",
    owner: "jonathan", location: "Remote", arrangement: "Remote",
    employment: "Full-time", status: "Applied",
    appliedDate: "Jun 12, 2026", updatedDate: "Jun 12, 2026", createdDate: "Jun 12, 2026",
    jobUrl: "https://stripe.com/jobs/strategic-finance",
    salaryMin: 120000, salaryMax: 160000, salaryCurrency: "USD", salaryPeriod: "Yearly",
    notes: "Strong match for FP&A background. Got a referral from Alex at Stripe. Waiting on recruiter screen.",
  },
  {
    id: "2", company: "Anthropic", role: "Finance & Strategy Analyst",
    owner: "kareem", location: "San Francisco, CA", arrangement: "Hybrid",
    employment: "Full-time", status: "Applied",
    appliedDate: "Jun 10, 2026", updatedDate: "Jun 11, 2026", createdDate: "Jun 10, 2026",
    jobUrl: "https://anthropic.com/careers/finance-analyst",
    salaryMin: 130000, salaryMax: 180000, salaryCurrency: "USD", salaryPeriod: "Yearly",
    jobDescription: "Finance & Strategy Analyst to support the CFO office and strategic planning initiatives across the company.",
  },
  {
    id: "3", company: "Ramp", role: "Business Operations Associate",
    owner: "jonathan", location: "New York, NY", arrangement: "Onsite",
    employment: "Full-time", status: "Rejected",
    appliedDate: "Jun 4, 2026", updatedDate: "Jun 9, 2026", createdDate: "Jun 4, 2026",
    jobUrl: "https://ramp.com/careers/biz-ops",
  },
  {
    id: "4", company: "Datadog", role: "FP&A Analyst",
    owner: "kareem", location: "Remote", arrangement: "Remote",
    employment: "Full-time", status: "Withdrawn",
    appliedDate: "May 29, 2026", updatedDate: "Jun 5, 2026", createdDate: "May 29, 2026",
    jobUrl: "https://datadog.com/careers/fpa",
  },
  {
    id: "5", company: "Notion", role: "GTM Finance Associate",
    owner: "jonathan", location: "San Francisco, CA", arrangement: "Hybrid",
    employment: "Full-time", status: "Closed",
    appliedDate: "May 22, 2026", updatedDate: "Jun 1, 2026", createdDate: "May 22, 2026",
    jobUrl: "https://notion.so/careers/gtm-finance",
  },
  {
    id: "6", company: "Figma", role: "Strategic Finance Manager",
    owner: "kareem", location: "Remote", arrangement: "Remote",
    employment: "Full-time", status: "Applied",
    appliedDate: "May 20, 2026", updatedDate: "May 20, 2026", createdDate: "May 20, 2026",
    jobUrl: "https://figma.com/careers/strategic-finance",
    salaryMin: 140000, salaryMax: 200000, salaryCurrency: "USD", salaryPeriod: "Yearly",
  },
  {
    id: "7", company: "OpenAI", role: "Finance Operations Associate",
    owner: "jonathan", location: "San Francisco, CA", arrangement: "Hybrid",
    employment: "Full-time", status: "Applied",
    appliedDate: "May 18, 2026", updatedDate: "May 18, 2026", createdDate: "May 18, 2026",
    jobUrl: "https://openai.com/careers/finance-ops",
  },
  {
    id: "8", company: "Vercel", role: "Business Operations Analyst",
    owner: "kareem", location: "Remote", arrangement: "Remote",
    employment: "Full-time", status: "Applied",
    appliedDate: "May 14, 2026", updatedDate: "May 14, 2026", createdDate: "May 14, 2026",
    jobUrl: "https://vercel.com/careers/biz-ops",
  },
];

const DELETED: DeletedApp[] = [
  {
    id: "d1", company: "Coinbase", role: "Finance Associate",
    owner: "jonathan", location: "Remote", arrangement: "Remote",
    employment: "Full-time", status: "Applied",
    appliedDate: "Jun 10, 2026", updatedDate: "Jun 13, 2026", createdDate: "Jun 10, 2026",
    jobUrl: "https://coinbase.com/careers", deletedDate: "Jun 13, 2026",
  },
  {
    id: "d2", company: "Asana", role: "Business Operations Analyst",
    owner: "jonathan", location: "San Francisco, CA", arrangement: "Hybrid",
    employment: "Full-time", status: "Applied",
    appliedDate: "Jun 5, 2026", updatedDate: "Jun 8, 2026", createdDate: "Jun 5, 2026",
    jobUrl: "https://asana.com/careers", deletedDate: "Jun 8, 2026",
  },
  {
    id: "d3", company: "Canva", role: "FP&A Analyst",
    owner: "jonathan", location: "Remote", arrangement: "Remote",
    employment: "Full-time", status: "Applied",
    appliedDate: "May 28, 2026", updatedDate: "Jun 2, 2026", createdDate: "May 28, 2026",
    jobUrl: "https://canva.com/careers", deletedDate: "Jun 2, 2026",
  },
  {
    id: "d4", company: "Dropbox", role: "Strategic Finance Analyst",
    owner: "kareem", location: "Remote", arrangement: "Remote",
    employment: "Full-time", status: "Rejected",
    appliedDate: "May 25, 2026", updatedDate: "Jun 1, 2026", createdDate: "May 25, 2026",
    jobUrl: "https://dropbox.com/careers", deletedDate: "Jun 1, 2026",
  },
  {
    id: "d5", company: "Slack", role: "Business Operations Manager",
    owner: "kareem", location: "San Francisco, CA", arrangement: "Hybrid",
    employment: "Full-time", status: "Applied",
    appliedDate: "May 20, 2026", updatedDate: "May 30, 2026", createdDate: "May 20, 2026",
    jobUrl: "https://slack.com/careers", deletedDate: "May 30, 2026",
  },
];

const USERS = {
  jonathan: { name: "Jonathan", email: "jonathan@example.com", color: "bg-indigo-600" },
  kareem: { name: "Kareem", email: "kareem@example.com", color: "bg-emerald-600" },
};

const WEEKLY_DATA = [
  { week: "Apr 28", jonathan: 1, kareem: 0 },
  { week: "May 5",  jonathan: 0, kareem: 1 },
  { week: "May 12", jonathan: 1, kareem: 1 },
  { week: "May 19", jonathan: 1, kareem: 1 },
  { week: "May 26", jonathan: 0, kareem: 1 },
  { week: "Jun 2",  jonathan: 1, kareem: 0 },
  { week: "Jun 9",  jonathan: 1, kareem: 1 },
  { week: "Jun 16", jonathan: 1, kareem: 0 },
];

const STATUS_DATA = [
  { name: "Applied",   value: 5, color: "#3b82f6" },
  { name: "Rejected",  value: 1, color: "#ef4444" },
  { name: "Withdrawn", value: 1, color: "#64748b" },
  { name: "Closed",    value: 1, color: "#f59e0b" },
];

const ARRANGEMENT_DATA = [
  { name: "Remote",  value: 4, color: "#10b981" },
  { name: "Hybrid",  value: 3, color: "#6366f1" },
  { name: "Onsite",  value: 1, color: "#94a3b8" },
];

const BY_USER_DATA = [
  { name: "Jonathan", applications: 4 },
  { name: "Kareem",   applications: 4 },
];

const ACTIVITY = [
  { user: "jonathan", action: "added",   company: "Stripe",    role: "Strategic Finance Associate",  time: "12 minutes ago" },
  { user: "kareem",   action: "updated", company: "Anthropic", role: "Finance & Strategy Analyst",   time: "2 hours ago",  detail: "Applied" },
  { user: "jonathan", action: "deleted", company: "Ramp",      role: "Business Operations Associate", time: "Yesterday" },
  { user: "kareem",   action: "restored",company: "Datadog",   role: "FP&A Analyst",                 time: "Yesterday" },
  { user: "jonathan", action: "updated", company: "Notion",    role: "GTM Finance Associate",        time: "3 days ago", detail: "Closed" },
];

// ─── Utility Components ───────────────────────────────────────────────────────

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function Avatar({ owner, size = "sm" }: { owner: Owner; size?: "sm" | "md" | "lg" }) {
  const u = USERS[owner];
  const sz =
    size === "sm" ? "w-6 h-6 text-[10px]" :
    size === "md" ? "w-8 h-8 text-xs" :
    "w-10 h-10 text-sm";
  return (
    <div className={`${sz} ${u.color} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}>
      {initials(u.name)}
    </div>
  );
}

function StatusPill({ status }: { status: AppStatus }) {
  const s: Record<AppStatus, string> = {
    Applied:   "bg-blue-500/15 text-blue-400 border border-blue-500/25",
    Rejected:  "bg-red-500/15 text-red-400 border border-red-500/25",
    Withdrawn: "bg-slate-500/15 text-slate-400 border border-slate-500/25",
    Closed:    "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s[status]}`}>
      {status}
    </span>
  );
}

function ArrangementPill({ arrangement }: { arrangement: Arrangement }) {
  const s: Record<Arrangement, string> = {
    Remote:  "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
    Hybrid:  "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25",
    Onsite:  "bg-slate-500/15 text-slate-400 border border-slate-500/25",
    Unknown: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/25",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s[arrangement]}`}>
      {arrangement}
    </span>
  );
}

function EmploymentPill({ employment }: { employment: Employment }) {
  const s: Record<Employment, string> = {
    "Full-time":  "bg-blue-500/15 text-blue-400 border border-blue-500/25",
    "Part-time":  "bg-teal-500/15 text-teal-400 border border-teal-500/25",
    "Contract":   "bg-amber-500/15 text-amber-400 border border-amber-500/25",
    "Internship": "bg-purple-500/15 text-purple-400 border border-purple-500/25",
    "Temporary":  "bg-orange-500/15 text-orange-400 border border-orange-500/25",
    "Unknown":    "bg-zinc-500/15 text-zinc-400 border border-zinc-500/25",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s[employment]}`}>
      {employment}
    </span>
  );
}

function EmptyState({
  title, description, action, icon,
}: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-[#111827] border border-white/[0.08] rounded-xl">
      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-4">
        {icon ?? <FileText size={22} className="text-slate-600" />}
      </div>
      <h3 className="text-base font-semibold text-slate-300 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-5 leading-relaxed">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── Top Nav ──────────────────────────────────────────────────────────────────

function TopNav({
  currentUser, setCurrentUser, activeView, navigate,
}: {
  currentUser: Owner;
  setCurrentUser: (u: Owner) => void;
  activeView: View;
  navigate: (v: View, id?: string) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [devMenuOpen, setDevMenuOpen] = useState(false);

  const NAV = [
    { view: "dashboard" as View,     label: "Dashboard",    icon: <LayoutDashboard size={14} /> },
    { view: "applications" as View,  label: "Applications", icon: <FileText size={14} /> },
    { view: "deleted" as View,       label: "Deleted",      icon: <Trash size={14} /> },
    { view: "workspace" as View,     label: "Workspace",    icon: <Users size={14} /> },
    { view: "profile" as View,       label: "Profile",      icon: <User size={14} /> },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-[#090e1d] border-b border-white/[0.07]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-4">

          {/* Logo */}
          <button
            onClick={() => navigate("dashboard")}
            className="flex items-center gap-2.5 flex-shrink-0"
          >
            <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
              <Briefcase size={13} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-100 hidden sm:block tracking-tight">
              ApplyTogether
            </span>
          </button>

          {/* Workspace chip */}
          <div className="hidden sm:flex items-center gap-1 text-xs text-slate-600">
            <span>/</span>
            <button className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded hover:bg-white/5">
              ApplyTogether
              <ChevronDown size={11} />
            </button>
          </div>

          {/* Nav tabs (desktop) */}
          <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {NAV.map((item) => (
              <button
                key={item.view}
                onClick={() => navigate(item.view)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  activeView === item.view
                    ? "bg-indigo-600/20 text-indigo-400"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Dev switcher */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setDevMenuOpen(!devMenuOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/[0.08] text-xs text-slate-300 hover:bg-white/5 transition-colors"
              >
                <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/20">
                  DEV
                </span>
                <Avatar owner={currentUser} size="sm" />
                <span className="text-slate-400">Viewing as {USERS[currentUser].name}</span>
                <ChevronDown size={11} className="text-slate-600" />
              </button>

              {devMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#141c2e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-white/[0.06]">
                    <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                      Dev identity
                    </p>
                  </div>
                  {(["jonathan", "kareem"] as Owner[]).map((u) => (
                    <button
                      key={u}
                      onClick={() => { setCurrentUser(u); setDevMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs hover:bg-white/5 transition-colors ${
                        currentUser === u ? "text-indigo-400" : "text-slate-300"
                      }`}
                    >
                      <Avatar owner={u} size="sm" />
                      <span className="flex-1 text-left">{USERS[u].name}</span>
                      {currentUser === u && <CheckCircle size={13} className="text-indigo-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => navigate("add")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Add Application</span>
              <span className="sm:hidden">Add</span>
            </button>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/[0.07] py-3 space-y-0.5">
            {NAV.map((item) => (
              <button
                key={item.view}
                onClick={() => { navigate(item.view); setMobileOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm ${
                  activeView === item.view
                    ? "bg-indigo-600/20 text-indigo-400"
                    : "text-slate-400 hover:bg-white/5"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
            <div className="pt-3 px-2 border-t border-white/[0.05] mt-2">
              <p className="text-[11px] text-slate-600 mb-2 px-1 uppercase tracking-wider font-medium">Dev identity</p>
              <div className="flex gap-2">
                {(["jonathan", "kareem"] as Owner[]).map((u) => (
                  <button
                    key={u}
                    onClick={() => setCurrentUser(u)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      currentUser === u
                        ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/20"
                        : "text-slate-400 bg-white/5"
                    }`}
                  >
                    <Avatar owner={u} size="sm" />
                    {USERS[u].name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardPage({
  currentUser, navigate,
}: {
  currentUser: Owner;
  navigate: (v: View, id?: string) => void;
}) {
  const myDeleted = DELETED.filter((a) => a.owner === currentUser);

  const jonathanApps = APPS.filter((a) => a.owner === "jonathan");
  const kareemApps   = APPS.filter((a) => a.owner === "kareem");

  const userStats = (owner: Owner) => {
    const oa = APPS.filter((a) => a.owner === owner);
    return {
      total:       oa.length,
      thisWeek:    owner === "jonathan" ? 1 : 1,
      rejected:    oa.filter((a) => a.status === "Rejected").length,
      lastApplied: oa.sort((a, b) => b.appliedDate.localeCompare(a.appliedDate))[0]?.appliedDate ?? "—",
      progress:    owner === "jonathan" ? 60 : 55,
    };
  };

  const TOOLTIP_STYLE = {
    background: "#1a2a3f",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    fontSize: 12,
    color: "#94a3b8",
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950/80 via-[#141b2d] to-[#0f1628] border border-indigo-500/15 p-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/[0.06] rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-600/[0.04] rounded-full blur-3xl translate-y-1/4 -translate-x-1/4 pointer-events-none" />
        <div className="relative">
          <p className="text-xs text-indigo-400 font-medium uppercase tracking-widest mb-3">
            Shared workspace · ApplyTogether
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2 tracking-tight">
            Track applications together
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mb-6 leading-relaxed">
            A shared workspace for logging jobs, staying accountable, and keeping visibility across the search.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => navigate("add")}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Plus size={15} />
              Add Application
            </button>
            <button
              onClick={() => navigate("applications")}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-200 text-sm font-medium rounded-lg border border-white/10 transition-colors"
            >
              View Applications
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total active applications", value: APPS.length,      color: "text-indigo-400", bg: "bg-indigo-500/10", icon: <FileText size={17} /> },
          { label: "Applications this week",    value: 2,                color: "text-emerald-400", bg: "bg-emerald-500/10", icon: <TrendingUp size={17} /> },
          { label: "Recently updated",          value: 3,                color: "text-blue-400", bg: "bg-blue-500/10", icon: <Clock size={17} /> },
          { label: "My deleted applications",   value: myDeleted.length, color: "text-amber-400", bg: "bg-amber-500/10", icon: <Trash size={17} /> },
        ].map((card) => (
          <div key={card.label} className="bg-[#111827] border border-white/[0.08] rounded-xl p-4">
            <div className={`inline-flex p-2 rounded-lg ${card.bg} mb-3`}>
              <div className={card.color}>{card.icon}</div>
            </div>
            <div className={`text-2xl font-bold ${card.color} mb-1`}>{card.value}</div>
            <div className="text-xs text-slate-500 leading-snug">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Accountability */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Team Accountability</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(["jonathan", "kareem"] as Owner[]).map((owner) => {
            const stats = userStats(owner);
            const u = USERS[owner];
            const isMe = currentUser === owner;
            return (
              <div
                key={owner}
                className={`bg-[#111827] rounded-xl p-5 border transition-colors ${
                  isMe ? "border-indigo-500/25" : "border-white/[0.08]"
                }`}
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <Avatar owner={owner} size="lg" />
                    <div>
                      <div className="font-semibold text-slate-100 text-sm">{u.name}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{u.email}</div>
                    </div>
                  </div>
                  {isMe && (
                    <span className="text-[11px] bg-indigo-600/15 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 font-medium">
                      You
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-white/[0.05]">
                  <div className="text-center">
                    <div className="text-xl font-bold text-slate-100">{stats.total}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">Active</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-emerald-400">{stats.thisWeek}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">This week</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-red-400">{stats.rejected}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">Rejected</div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] text-slate-600">Weekly progress</span>
                    <span className="text-[11px] text-slate-500">{stats.progress}%</span>
                  </div>
                  <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${stats.progress}%` }}
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-600">
                  Last applied: <span className="text-slate-500">{stats.lastApplied}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Analytics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Applications over time */}
          <div className="bg-[#111827] border border-white/[0.08] rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-300 mb-5">Applications over time</h3>
            <ResponsiveContainer width="100%" height={175}>
              <BarChart data={WEEKLY_DATA} barSize={12} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} width={18} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="jonathan" name="Jonathan" fill="#6366f1" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="kareem"   name="Kareem"   fill="#10b981" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-5 mt-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <div className="w-2 h-2 rounded-sm bg-indigo-500" />Jonathan
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <div className="w-2 h-2 rounded-sm bg-emerald-500" />Kareem
              </div>
            </div>
          </div>

          {/* By user */}
          <div className="bg-[#111827] border border-white/[0.08] rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-300 mb-5">Applications by user</h3>
            <ResponsiveContainer width="100%" height={175}>
              <BarChart data={BY_USER_DATA} layout="vertical" barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} width={72} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="applications" fill="#6366f1" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status mix */}
          <div className="bg-[#111827] border border-white/[0.08] rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Status mix</h3>
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                <PieChart width={130} height={130}>
                  <Pie
                    data={STATUS_DATA} cx="50%" cy="50%"
                    innerRadius={38} outerRadius={56}
                    paddingAngle={3} dataKey="value" isAnimationActive={false}
                  >
                    {STATUS_DATA.map((entry) => (
                      <Cell key={`status-${entry.name}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </div>
              <div className="space-y-2.5 flex-1">
                {STATUS_DATA.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-slate-500">{d.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-300">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Work arrangement mix */}
          <div className="bg-[#111827] border border-white/[0.08] rounded-xl p-5">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Work arrangement mix</h3>
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                <PieChart width={130} height={130}>
                  <Pie
                    data={ARRANGEMENT_DATA} cx="50%" cy="50%"
                    innerRadius={38} outerRadius={56}
                    paddingAngle={3} dataKey="value" isAnimationActive={false}
                  >
                    {ARRANGEMENT_DATA.map((entry) => (
                      <Cell key={`arr-${entry.name}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </div>
              <div className="space-y-2.5 flex-1">
                {ARRANGEMENT_DATA.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-slate-500">{d.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-300">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Recent Activity</h2>
        <div className="bg-[#111827] border border-white/[0.08] rounded-xl divide-y divide-white/[0.04]">
          {ACTIVITY.map((item, i) => {
            const dotColor =
              item.action === "added"    ? "bg-emerald-500" :
              item.action === "deleted"  ? "bg-red-500" :
              item.action === "restored" ? "bg-blue-500" :
              "bg-amber-500";
            return (
              <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                <Avatar owner={item.user as Owner} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-400 leading-snug">
                    <span className="font-medium text-slate-200">{USERS[item.user as Owner].name}</span>
                    {" "}
                    <span className="text-slate-500">
                      {item.action === "added"    && "added"}
                      {item.action === "updated"  && "updated"}
                      {item.action === "deleted"  && "deleted"}
                      {item.action === "restored" && "restored"}
                    </span>
                    {" "}
                    <span className="text-slate-300">{item.role}</span>
                    {" "}
                    <span className="text-slate-600">at {item.company}</span>
                    {item.detail && (
                      <span className="ml-1">
                        <StatusPill status={item.detail as AppStatus} />
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{item.time}</p>
                </div>
                <div className={`w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0 mt-2`} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Applications List ────────────────────────────────────────────────────────

function ApplicationsPage({
  currentUser, navigate,
}: {
  currentUser: Owner;
  navigate: (v: View, id?: string) => void;
}) {
  const [search,      setSearch]      = useState("");
  const [ownerFilter, setOwnerFilter] = useState<"all" | Owner>("all");
  const [statusFilter,      setStatusFilter]      = useState<"all" | AppStatus>("all");
  const [arrangementFilter, setArrangementFilter] = useState<"all" | Arrangement>("all");
  const [employmentFilter,  setEmploymentFilter]  = useState<"all" | Employment>("all");
  const [sortBy,  setSortBy]  = useState("appliedDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    let apps = [...APPS];
    if (search) {
      const q = search.toLowerCase();
      apps = apps.filter(
        (a) => a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)
      );
    }
    if (ownerFilter      !== "all") apps = apps.filter((a) => a.owner       === ownerFilter);
    if (statusFilter     !== "all") apps = apps.filter((a) => a.status      === statusFilter);
    if (arrangementFilter !== "all") apps = apps.filter((a) => a.arrangement === arrangementFilter);
    if (employmentFilter !== "all") apps = apps.filter((a) => a.employment  === employmentFilter);

    apps.sort((a, b) => {
      const va = sortBy === "company" ? a.company : sortBy === "role" ? a.role : sortBy === "updatedDate" ? a.updatedDate : a.appliedDate;
      const vb = sortBy === "company" ? b.company : sortBy === "role" ? b.role : sortBy === "updatedDate" ? b.updatedDate : b.appliedDate;
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    return apps;
  }, [search, ownerFilter, statusFilter, arrangementFilter, employmentFilter, sortBy, sortDir]);

  const hasFilters = !!(search || ownerFilter !== "all" || statusFilter !== "all" || arrangementFilter !== "all" || employmentFilter !== "all");

  const clearFilters = () => {
    setSearch(""); setOwnerFilter("all"); setStatusFilter("all");
    setArrangementFilter("all"); setEmploymentFilter("all");
  };

  const selectClass = "px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-colors";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Applications</h1>
          <p className="text-sm text-slate-500 mt-0.5">View every active application in the shared workspace.</p>
        </div>
        <button
          onClick={() => navigate("add")}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus size={15} />
          Add Application
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#111827] border border-white/[0.08] rounded-xl p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-44">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company or job title"
              className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value as any)} className={selectClass} style={{ colorScheme: "dark" }}>
            <option value="all">All owners</option>
            <option value="jonathan">Jonathan</option>
            <option value="kareem">Kareem</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className={selectClass} style={{ colorScheme: "dark" }}>
            <option value="all">All statuses</option>
            <option value="Applied">Applied</option>
            <option value="Rejected">Rejected</option>
            <option value="Withdrawn">Withdrawn</option>
            <option value="Closed">Closed</option>
          </select>
          <select value={arrangementFilter} onChange={(e) => setArrangementFilter(e.target.value as any)} className={selectClass} style={{ colorScheme: "dark" }}>
            <option value="all">All arrangements</option>
            <option value="Remote">Remote</option>
            <option value="Hybrid">Hybrid</option>
            <option value="Onsite">Onsite</option>
            <option value="Unknown">Unknown</option>
          </select>
          <select value={employmentFilter} onChange={(e) => setEmploymentFilter(e.target.value as any)} className={selectClass} style={{ colorScheme: "dark" }}>
            <option value="all">All types</option>
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract">Contract</option>
            <option value="Internship">Internship</option>
            <option value="Temporary">Temporary</option>
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-slate-600 hover:text-slate-400 underline underline-offset-2 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">Sort by</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectClass} style={{ colorScheme: "dark" }}>
            <option value="appliedDate">Application date</option>
            <option value="updatedDate">Updated date</option>
            <option value="company">Company name</option>
            <option value="role">Job title</option>
          </select>
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-400 hover:bg-white/10 transition-colors"
          >
            <ArrowUpDown size={11} />
            {sortDir === "asc" ? "Asc" : "Desc"}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No applications match your filters"
          description="Try clearing filters or searching a different company or role."
          action={hasFilters ? { label: "Clear filters", onClick: clearFilters } : undefined}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-[#111827] border border-white/[0.08] rounded-xl overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Company", "Role", "Owner", "Location", "Arrangement", "Type", "Status", "Applied", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filtered.map((app) => {
                    const owned = app.owner === currentUser;
                    return (
                      <tr key={app.id} className="hover:bg-white/[0.015] transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-slate-200">{app.company}</span>
                            <a
                              href={app.jobUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ExternalLink size={11} className="text-slate-600 hover:text-slate-400" />
                            </a>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-400 leading-snug">{app.role}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar owner={app.owner} size="sm" />
                            <span className="text-xs text-slate-500">{USERS[app.owner].name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-600 max-w-28 block truncate">{app.location}</span>
                        </td>
                        <td className="px-4 py-3">
                          <ArrangementPill arrangement={app.arrangement} />
                        </td>
                        <td className="px-4 py-3">
                          <EmploymentPill employment={app.employment} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={app.status} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-600 whitespace-nowrap">{app.appliedDate}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => navigate("detail", app.id)}
                              title="View"
                              className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-white/5 rounded transition-colors"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() =>
                                owned
                                  ? navigate("edit", app.id)
                                  : toast.error("Only the application owner can edit this.")
                              }
                              title={owned ? "Edit" : "Only the application owner can edit this."}
                              className={`p-1.5 rounded transition-colors ${
                                owned
                                  ? "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                                  : "text-slate-700 cursor-not-allowed"
                              }`}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() =>
                                owned
                                  ? toast.success(`${app.company} deleted.`)
                                  : toast.error("Only the application owner can delete this.")
                              }
                              title={owned ? "Delete" : "Only the application owner can delete this."}
                              className={`p-1.5 rounded transition-colors ${
                                owned
                                  ? "text-slate-500 hover:text-red-400 hover:bg-red-500/5"
                                  : "text-slate-700 cursor-not-allowed"
                              }`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3 mb-4">
            {filtered.map((app) => {
              const owned = app.owner === currentUser;
              return (
                <div key={app.id} className="bg-[#111827] border border-white/[0.08] rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-semibold text-slate-100 text-sm">{app.company}</span>
                        <ExternalLink size={11} className="text-slate-600" />
                      </div>
                      <span className="text-xs text-slate-500">{app.role}</span>
                    </div>
                    <StatusPill status={app.status} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <ArrangementPill arrangement={app.arrangement} />
                    <EmploymentPill employment={app.employment} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar owner={app.owner} size="sm" />
                      <span className="text-xs text-slate-600">
                        {USERS[app.owner].name} · {app.appliedDate}
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      <button onClick={() => navigate("detail", app.id)} className="p-1.5 text-slate-500 hover:text-slate-200 rounded transition-colors">
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={() => owned ? navigate("edit", app.id) : toast.error("Only the application owner can edit this.")}
                        className={`p-1.5 rounded transition-colors ${owned ? "text-slate-500" : "text-slate-700"}`}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => owned ? toast.success("Deleted.") : toast.error("Only the application owner can delete this.")}
                        className={`p-1.5 rounded transition-colors ${owned ? "text-red-400" : "text-slate-700"}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing 1–{Math.min(pageSize, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 bg-white/5 border border-white/10 rounded text-slate-400 focus:outline-none text-xs"
                style={{ colorScheme: "dark" }}
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1 hover:bg-white/5 rounded transition-colors disabled:opacity-30"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-slate-400 font-medium px-1">{page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                className="p-1 hover:bg-white/5 rounded transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Application Detail ───────────────────────────────────────────────────────

function ApplicationDetailPage({
  appId, currentUser, navigate,
}: {
  appId: string;
  currentUser: Owner;
  navigate: (v: View, id?: string) => void;
}) {
  const app = APPS.find((a) => a.id === appId);
  if (!app) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16 text-center text-slate-500">
        Application not found.
      </div>
    );
  }

  const isOwner = app.owner === currentUser;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-600 mb-6">
        <button
          onClick={() => navigate("applications")}
          className="hover:text-slate-400 transition-colors flex items-center gap-1"
        >
          <ArrowLeft size={11} />
          Applications
        </button>
        <span>/</span>
        <span className="text-slate-500">{app.company}</span>
        <span>/</span>
        <span className="text-slate-500">{app.role}</span>
      </div>

      {/* Not-owner notice */}
      {!isOwner && (
        <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 mb-6">
          <Info size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300/80 leading-relaxed">
            You can view this because you share the workspace, but only the application owner can make changes.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{app.company}</h1>
            <StatusPill status={app.status} />
          </div>
          <p className="text-slate-400 mb-3">{app.role}</p>
          <div className="flex items-center gap-2">
            <Avatar owner={app.owner} size="sm" />
            <span className="text-sm text-slate-500">{USERS[app.owner].name}</span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <a
            href={app.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/[0.08] text-slate-300 text-xs font-medium rounded-lg transition-colors"
          >
            <ExternalLink size={13} />
            Open Job Posting
          </a>
          <button
            onClick={() =>
              isOwner
                ? navigate("edit", app.id)
                : toast.error("Only the application owner can edit this.")
            }
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              isOwner
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "bg-white/5 text-slate-600 border border-white/[0.05] cursor-not-allowed"
            }`}
          >
            <Pencil size={13} />
            Edit Application
          </button>
          <button
            onClick={() =>
              isOwner
                ? toast.success("Application deleted.")
                : toast.error("Only the application owner can delete this.")
            }
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              isOwner
                ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                : "bg-white/5 text-slate-600 border border-white/[0.05] cursor-not-allowed"
            }`}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">

          {/* Overview */}
          <div className="bg-[#111827] border border-white/[0.08] rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Building2 size={13} className="text-indigo-400" />
              Overview
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {[
                { label: "Company",          value: app.company },
                { label: "Job title",        value: app.role },
                { label: "Owner",            value: USERS[app.owner].name },
                { label: "Status",           value: <StatusPill status={app.status} /> },
                { label: "Applied date",     value: app.appliedDate },
                { label: "Location",         value: app.location },
                { label: "Work arrangement", value: <ArrangementPill arrangement={app.arrangement} /> },
                { label: "Employment type",  value: <EmploymentPill employment={app.employment} /> },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-[11px] text-slate-600 mb-1 uppercase tracking-wider">{label}</div>
                  <div className="text-sm text-slate-200">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Compensation */}
          {(app.salaryMin || app.salaryMax) && (
            <div className="bg-[#111827] border border-white/[0.08] rounded-xl p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <DollarSign size={13} className="text-emerald-400" />
                Compensation
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {app.salaryMin && (
                  <div>
                    <div className="text-[11px] text-slate-600 mb-1 uppercase tracking-wider">Salary min</div>
                    <div className="text-sm text-slate-200">{app.salaryCurrency} {app.salaryMin.toLocaleString()}</div>
                  </div>
                )}
                {app.salaryMax && (
                  <div>
                    <div className="text-[11px] text-slate-600 mb-1 uppercase tracking-wider">Salary max</div>
                    <div className="text-sm text-slate-200">{app.salaryCurrency} {app.salaryMax.toLocaleString()}</div>
                  </div>
                )}
                {app.salaryCurrency && (
                  <div>
                    <div className="text-[11px] text-slate-600 mb-1 uppercase tracking-wider">Currency</div>
                    <div className="text-sm text-slate-200">{app.salaryCurrency}</div>
                  </div>
                )}
                {app.salaryPeriod && (
                  <div>
                    <div className="text-[11px] text-slate-600 mb-1 uppercase tracking-wider">Period</div>
                    <div className="text-sm text-slate-200">{app.salaryPeriod}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Job posting */}
          <div className="bg-[#111827] border border-white/[0.08] rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Link2 size={13} className="text-blue-400" />
              Job Posting
            </h3>
            <div>
              <div className="text-[11px] text-slate-600 mb-1.5 uppercase tracking-wider">URL</div>
              <a
                href={app.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 break-all transition-colors"
              >
                {app.jobUrl}
                <ExternalLink size={11} className="flex-shrink-0" />
              </a>
              <p className="text-xs text-slate-600 mt-2">
                Used to prevent duplicate applications for the same posting.
              </p>
            </div>
          </div>

          {app.jobDescription && (
            <div className="bg-[#111827] border border-white/[0.08] rounded-xl p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileCode size={13} className="text-purple-400" />
                Job Description
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">{app.jobDescription}</p>
            </div>
          )}

          {app.notes && (
            <div className="bg-[#111827] border border-white/[0.08] rounded-xl p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <StickyNote size={13} className="text-amber-400" />
                Notes
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">{app.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar metadata */}
        <div>
          <div className="bg-[#111827] border border-white/[0.08] rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Info size={13} className="text-slate-500" />
              Metadata
            </h3>
            <div className="space-y-4">
              <div>
                <div className="text-[11px] text-slate-600 mb-1 uppercase tracking-wider">Created</div>
                <div className="text-xs text-slate-400">{app.createdDate}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-600 mb-1 uppercase tracking-wider">Last updated</div>
                <div className="text-xs text-slate-400">{app.updatedDate}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-600 mb-1 uppercase tracking-wider">Workspace</div>
                <div className="text-xs text-slate-400">ApplyTogether</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-600 mb-1.5 uppercase tracking-wider">Owner</div>
                <div className="flex items-center gap-2">
                  <Avatar owner={app.owner} size="sm" />
                  <span className="text-xs text-slate-400">{USERS[app.owner].name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add / Edit Form ──────────────────────────────────────────────────────────

const EMPTY_FORM: FormState = {
  company: "", role: "", jobUrl: "", location: "",
  arrangement: "Remote", employment: "Full-time", status: "Applied",
  appliedDate: "", salaryMin: "", salaryMax: "",
  salaryCurrency: "USD", salaryPeriod: "Yearly",
  jobDescription: "", notes: "",
};

function ApplicationFormPage({
  mode, appId, currentUser, navigate,
}: {
  mode: "add" | "edit";
  appId?: string;
  currentUser: Owner;
  navigate: (v: View, id?: string) => void;
}) {
  const existing = mode === "edit" && appId ? APPS.find((a) => a.id === appId) : null;

  const [form, setForm] = useState<FormState>(
    existing
      ? {
          company:      existing.company,
          role:         existing.role,
          jobUrl:       existing.jobUrl,
          location:     existing.location,
          arrangement:  existing.arrangement,
          employment:   existing.employment,
          status:       existing.status,
          appliedDate:  existing.appliedDate,
          salaryMin:    existing.salaryMin?.toString() ?? "",
          salaryMax:    existing.salaryMax?.toString() ?? "",
          salaryCurrency: existing.salaryCurrency ?? "USD",
          salaryPeriod:   existing.salaryPeriod ?? "Yearly",
          jobDescription: existing.jobDescription ?? "",
          notes:          existing.notes ?? "",
        }
      : EMPTY_FORM
  );

  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value } as FormState));
      setErrors((er) => ({ ...er, [key]: "" }));
    };

  const validate = () => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.company)  errs.company  = "Company name is required.";
    if (!form.role)     errs.role     = "Job title is required.";
    if (!form.jobUrl)   errs.jobUrl   = "Job posting URL is required.";
    if (!form.location) errs.location = "Location is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      toast.error("Please review the highlighted fields.");
      return;
    }
    toast.success(mode === "add" ? "Application saved." : "Changes saved.");
    navigate("applications");
  };

  const inputCls = (field: keyof FormState) =>
    `w-full px-3 py-2.5 bg-white/[0.04] border rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none transition-colors ${
      errors[field]
        ? "border-red-500/40 focus:border-red-500/70"
        : "border-white/[0.08] focus:border-indigo-500/50"
    }`;

  const sectionCard = "bg-[#111827] border border-white/[0.08] rounded-xl p-6 space-y-5";
  const sectionHead = "text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 mb-1 border-b border-white/[0.06]";

  const TIPS = [
    {
      title: "Job posting URL",
      body: "Paste the direct link to the job listing. This is used to detect duplicate applications in the workspace.",
    },
    {
      title: "Shared visibility",
      body: "Both Jonathan and Kareem will see this application once saved. Only you can edit or delete it.",
    },
    {
      title: "Compensation",
      body: "Salary info is private context — fill it in if you have it so you can track comp ranges across applications.",
    },
    {
      title: "Notes field",
      body: "Use this for referral contacts, recruiter info, or impressions from a phone screen.",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-28">

      <button
        onClick={() => navigate("applications")}
        className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 mb-6 transition-colors"
      >
        <ArrowLeft size={12} />
        Back to Applications
      </button>

      <h1 className="text-2xl font-bold text-slate-100 tracking-tight mb-1">
        {mode === "add" ? "Add Application" : "Edit Application"}
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        {mode === "add"
          ? "Log a job application for your shared workspace. You will be the owner of this application."
          : "Update the application details. Workspace and owner cannot be changed."}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Edit: locked ownership */}
          {mode === "edit" && (
            <div className="bg-[#111827] border border-white/[0.08] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lock size={13} className="text-slate-600" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ownership</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[11px] text-slate-600 mb-1 uppercase tracking-wider">Workspace</div>
                  <div className="text-sm text-slate-400">ApplyTogether</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-600 mb-1 uppercase tracking-wider">Owner</div>
                  <div className="flex items-center gap-2">
                    <Avatar owner={currentUser} size="sm" />
                    <span className="text-sm text-slate-400">{USERS[currentUser].name}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-3">
                Owner and workspace are assigned automatically and cannot be changed.
              </p>
            </div>
          )}

          {/* Section 1 */}
          <div className={sectionCard}>
            <h2 className={sectionHead}>Job basics</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Company name <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.company}
                  onChange={set("company")}
                  placeholder="e.g. Stripe"
                  className={inputCls("company")}
                />
                {errors.company && <p className="text-xs text-red-400 mt-1">{errors.company}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Job title <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.role}
                  onChange={set("role")}
                  placeholder="e.g. Strategic Finance Associate"
                  className={inputCls("role")}
                />
                {errors.role && <p className="text-xs text-red-400 mt-1">{errors.role}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Job posting URL <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.jobUrl}
                  onChange={set("jobUrl")}
                  placeholder="https://company.com/careers/..."
                  className={inputCls("jobUrl")}
                />
                {errors.jobUrl && <p className="text-xs text-red-400 mt-1">{errors.jobUrl}</p>}
                <p className="text-xs text-slate-600 mt-1.5">
                  Used to prevent duplicate applications for the same posting.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Location <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.location}
                  onChange={set("location")}
                  placeholder="e.g. Remote or San Francisco, CA"
                  className={inputCls("location")}
                />
                {errors.location && <p className="text-xs text-red-400 mt-1">{errors.location}</p>}
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div className={sectionCard}>
            <h2 className={sectionHead}>Application details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Work arrangement <span className="text-red-400">*</span>
                </label>
                <select value={form.arrangement} onChange={set("arrangement")} className={inputCls("arrangement")} style={{ colorScheme: "dark" }}>
                  {["Remote", "Hybrid", "Onsite", "Unknown"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Employment type <span className="text-red-400">*</span>
                </label>
                <select value={form.employment} onChange={set("employment")} className={inputCls("employment")} style={{ colorScheme: "dark" }}>
                  {["Full-time", "Part-time", "Contract", "Internship", "Temporary", "Unknown"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
                <select value={form.status} onChange={set("status")} className={inputCls("status")} style={{ colorScheme: "dark" }}>
                  {["Applied", "Rejected", "Withdrawn", "Closed"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Application date</label>
                <input
                  type="date"
                  value={form.appliedDate}
                  onChange={set("appliedDate")}
                  className={inputCls("appliedDate")}
                  style={{ colorScheme: "dark" }}
                />
                <p className="text-xs text-slate-600 mt-1.5">Defaults to today if left blank.</p>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className={sectionCard}>
            <h2 className={sectionHead}>
              Compensation{" "}
              <span className="text-[10px] font-normal text-slate-600 normal-case tracking-normal">
                (optional)
              </span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { key: "salaryMin" as const, label: "Salary min", placeholder: "120000" },
                { key: "salaryMax" as const, label: "Salary max", placeholder: "160000" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
                  <input value={form[key]} onChange={set(key)} placeholder={placeholder} className={inputCls(key)} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Currency</label>
                <select value={form.salaryCurrency} onChange={set("salaryCurrency")} className={inputCls("salaryCurrency")} style={{ colorScheme: "dark" }}>
                  {["USD", "EUR", "GBP", "CAD", "AUD"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Period</label>
                <select value={form.salaryPeriod} onChange={set("salaryPeriod")} className={inputCls("salaryPeriod")} style={{ colorScheme: "dark" }}>
                  {["Hourly", "Monthly", "Yearly"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Salary period is required when salary information is provided.
            </p>
          </div>

          {/* Section 4 */}
          <div className={sectionCard}>
            <h2 className={sectionHead}>
              Details{" "}
              <span className="text-[10px] font-normal text-slate-600 normal-case tracking-normal">
                (optional)
              </span>
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Job description</label>
              <textarea
                value={form.jobDescription}
                onChange={set("jobDescription")}
                placeholder="Paste the job description here..."
                rows={5}
                className={`${inputCls("jobDescription")} resize-none`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={set("notes")}
                placeholder="Recruiter contacts, referrals, interview notes..."
                rows={4}
                className={`${inputCls("notes")} resize-none`}
              />
            </div>
          </div>
        </div>

        {/* Tips sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-24 bg-[#111827] border border-white/[0.08] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Info size={13} className="text-indigo-400" />
              <span className="text-xs font-semibold text-slate-300">Form tips</span>
            </div>
            <div className="space-y-4">
              {TIPS.map((tip) => (
                <div key={tip.title}>
                  <div className="text-xs font-medium text-slate-400 mb-1">{tip.title}</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{tip.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-white/[0.05]">
              <div className="flex items-center gap-2">
                <Avatar owner={currentUser} size="sm" />
                <span className="text-xs text-slate-600">
                  Saving as <span className="text-slate-400">{USERS[currentUser].name}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#090e1d]/95 backdrop-blur border-t border-white/[0.07] py-4 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-end gap-3">
          <button
            onClick={() => navigate("applications")}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {mode === "add" ? "Save Application" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Deleted Applications ─────────────────────────────────────────────────────

function DeletedPage({
  currentUser, navigate,
}: {
  currentUser: Owner;
  navigate: (v: View, id?: string) => void;
}) {
  const myDeleted = DELETED.filter((a) => a.owner === currentUser);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">Deleted Applications</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Only applications you deleted appear here. Restore an application before editing it.
        </p>
      </div>

      <div className="flex items-start gap-3 bg-[#111827] border border-white/[0.08] rounded-xl p-4 mb-5">
        <Info size={14} className="text-slate-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-slate-500 leading-relaxed">
          Deleted applications remain hidden from the active workspace list. Restoring makes them visible again.
        </p>
      </div>

      {myDeleted.length === 0 ? (
        <EmptyState
          title="No deleted applications"
          description={`Applications you delete will appear here. You currently have no deleted applications, ${USERS[currentUser].name}.`}
          icon={<Trash size={22} className="text-slate-600" />}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-[#111827] border border-white/[0.08] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Company", "Role", "Status", "Applied date", "Deleted date", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {myDeleted.map((app) => (
                  <tr key={app.id} className="hover:bg-white/[0.015] transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-300">{app.company}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{app.role}</td>
                    <td className="px-4 py-3"><StatusPill status={app.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{app.appliedDate}</td>
                    <td className="px-4 py-3 text-xs text-red-400/70">{app.deletedDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate("deleted-detail", app.id)}
                          className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-white/5 rounded transition-colors"
                          title="View"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => toast.success(`${app.company} restored.`)}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors border border-emerald-500/20"
                        >
                          <RotateCcw size={11} />
                          Restore
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {myDeleted.map((app) => (
              <div key={app.id} className="bg-[#111827] border border-white/[0.08] rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-slate-200 text-sm">{app.company}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{app.role}</div>
                  </div>
                  <StatusPill status={app.status} />
                </div>
                <div className="text-xs text-red-400/70 mb-3">Deleted {app.deletedDate}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate("deleted-detail", app.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 bg-white/5 rounded-lg"
                  >
                    <Eye size={12} /> View
                  </button>
                  <button
                    onClick={() => toast.success("Restored.")}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-emerald-400 bg-emerald-500/10 rounded-lg"
                  >
                    <RotateCcw size={12} /> Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Deleted Detail ───────────────────────────────────────────────────────────

function DeletedDetailPage({
  deletedId, navigate,
}: {
  deletedId: string;
  navigate: (v: View, id?: string) => void;
}) {
  const app = DELETED.find((a) => a.id === deletedId);
  if (!app) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16 text-center text-slate-500">
        Application not found.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-2 text-xs text-slate-600 mb-6">
        <button
          onClick={() => navigate("deleted")}
          className="hover:text-slate-400 transition-colors flex items-center gap-1"
        >
          <ArrowLeft size={11} />
          Deleted Applications
        </button>
        <span>/</span>
        <span className="text-slate-500">{app.company}</span>
      </div>

      {/* Deleted banner */}
      <div className="flex items-center gap-3 bg-red-500/5 border border-red-500/15 rounded-xl p-4 mb-6 flex-wrap gap-y-3">
        <AlertCircle size={15} className="text-red-400 flex-shrink-0" />
        <p className="text-sm text-red-300 flex-1">
          This application is deleted. Restore it before making edits.
        </p>
        <button
          onClick={() => toast.success(`${app.company} restored.`)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg border border-emerald-500/20 transition-colors flex-shrink-0"
        >
          <RotateCcw size={12} />
          Restore Application
        </button>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-400 tracking-tight">{app.company}</h1>
            <StatusPill status={app.status} />
          </div>
          <p className="text-slate-600">{app.role}</p>
        </div>
      </div>

      <div className="bg-[#111827] border border-white/[0.08] rounded-xl p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          {[
            { label: "Company",          value: app.company },
            { label: "Role",             value: app.role },
            { label: "Owner",            value: USERS[app.owner].name },
            { label: "Status",           value: <StatusPill status={app.status} /> },
            { label: "Applied date",     value: app.appliedDate },
            { label: "Deleted date",     value: <span className="text-red-400/80">{app.deletedDate}</span> },
            { label: "Work arrangement", value: <ArrangementPill arrangement={app.arrangement} /> },
            { label: "Employment type",  value: <EmploymentPill employment={app.employment} /> },
            { label: "Location",         value: app.location },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-[11px] text-slate-600 mb-1 uppercase tracking-wider">{label}</div>
              <div className="text-sm text-slate-300">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Workspace ────────────────────────────────────────────────────────────────

function WorkspacePage({ currentUser }: { currentUser: Owner }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">Workspace</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Your shared workspace settings and members.
        </p>
      </div>

      <div className="bg-[#111827] border border-white/[0.08] rounded-xl p-6 mb-4">
        <div className="flex items-start gap-4 mb-6 pb-6 border-b border-white/[0.05]">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Briefcase size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">ApplyTogether</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[11px] bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 font-medium">
                Owner
              </span>
              <span className="text-xs text-slate-600">Your role in this workspace</span>
            </div>
          </div>
        </div>

        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Members</h3>
        <div className="space-y-2">
          {(["jonathan", "kareem"] as Owner[]).map((u) => (
            <div
              key={u}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
                currentUser === u
                  ? "bg-indigo-500/5 border-indigo-500/15"
                  : "bg-white/[0.02] border-white/[0.05]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Avatar owner={u} size="md" />
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    {USERS[u].name}
                    {currentUser === u && (
                      <span className="ml-2 text-[11px] text-indigo-400 font-normal">(You)</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">{USERS[u].email}</div>
                </div>
              </div>
              <span className="text-[11px] bg-slate-500/15 text-slate-400 border border-slate-500/20 px-2 py-0.5 rounded font-medium">
                Owner
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 bg-[#111827] border border-white/[0.08] rounded-xl p-5">
        <Info size={14} className="text-slate-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-slate-500 leading-relaxed">
          Workspace owners can manage workspace-level settings in future milestones. For now, application editing is based on application ownership, not workspace role.
        </p>
      </div>
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

function ProfilePage({
  currentUser, setCurrentUser,
}: {
  currentUser: Owner;
  setCurrentUser: (u: Owner) => void;
}) {
  const u = USERS[currentUser];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Your current identity and workspace access.
        </p>
      </div>

      <div className="bg-[#111827] border border-white/[0.08] rounded-xl p-6 mb-4">
        {/* Avatar + name */}
        <div className="flex items-start gap-5 mb-6 pb-6 border-b border-white/[0.05]">
          <div className={`w-16 h-16 ${USERS[currentUser].color} rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0`}>
            {initials(u.name)}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">{u.name}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{u.email}</p>
            <div className="flex items-center gap-2 mt-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-emerald-400 font-medium">Active</span>
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6 pb-6 border-b border-white/[0.05]">
          {[
            { label: "Display name",       value: u.name },
            { label: "Email",              value: u.email },
            { label: "Workspace access",   value: "ApplyTogether" },
            { label: "Workspace role",     value: "Owner" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-[11px] text-slate-600 mb-1 uppercase tracking-wider">{label}</div>
              <div className="text-sm text-slate-300">{value}</div>
            </div>
          ))}
        </div>

        {/* Dev identity card */}
        <div className="bg-amber-500/[0.04] border border-amber-500/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={13} className="text-amber-500" />
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Development identity
            </span>
          </div>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Authentication is simulated during development with the X-User-Id header.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(["jonathan", "kareem"] as Owner[]).map((owner) => (
              <button
                key={owner}
                onClick={() => setCurrentUser(owner)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                  currentUser === owner
                    ? "bg-indigo-600/15 border-indigo-500/25 text-indigo-300"
                    : "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.06]"
                }`}
              >
                <Avatar owner={owner} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{USERS[owner].name}</div>
                  <div className="text-xs opacity-50 truncate">{USERS[owner].email}</div>
                </div>
                {currentUser === owner && (
                  <CheckCircle size={14} className="text-indigo-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [currentUser, setCurrentUser] = useState<Owner>("jonathan");
  const [view,       setView]       = useState<View>("dashboard");
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const navigate = (v: View, id?: string) => {
    setView(v);
    setSelectedId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderPage = () => {
    switch (view) {
      case "dashboard":
        return <DashboardPage currentUser={currentUser} navigate={navigate} />;
      case "applications":
        return <ApplicationsPage currentUser={currentUser} navigate={navigate} />;
      case "detail":
        return <ApplicationDetailPage appId={selectedId!} currentUser={currentUser} navigate={navigate} />;
      case "add":
        return <ApplicationFormPage mode="add" currentUser={currentUser} navigate={navigate} />;
      case "edit":
        return <ApplicationFormPage mode="edit" appId={selectedId} currentUser={currentUser} navigate={navigate} />;
      case "deleted":
        return <DeletedPage currentUser={currentUser} navigate={navigate} />;
      case "deleted-detail":
        return <DeletedDetailPage deletedId={selectedId!} navigate={navigate} />;
      case "workspace":
        return <WorkspacePage currentUser={currentUser} />;
      case "profile":
        return <ProfilePage currentUser={currentUser} setCurrentUser={setCurrentUser} />;
      default:
        return null;
    }
  };

  return (
    <div className="dark min-h-screen" style={{ fontFamily: "'Inter', sans-serif", colorScheme: "dark" }}>
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
      <TopNav
        currentUser={currentUser}
        setCurrentUser={(u) => { setCurrentUser(u); toast.success(`Switched to ${USERS[u].name}`); }}
        activeView={view}
        navigate={navigate}
      />
      <main className="bg-[#0c1120] min-h-[calc(100vh-3.5rem)]">
        {renderPage()}
      </main>
    </div>
  );
}
