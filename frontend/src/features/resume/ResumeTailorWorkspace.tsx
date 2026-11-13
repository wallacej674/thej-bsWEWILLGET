import { useId } from "react";
import { Link } from "react-router";
import { Check, Copy, Plus, Sparkles, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

import type { ApiClient } from "../applications/api";
import type { JobApplication, ResumeTailorAnalysis } from "../applications/types";
import { timeAgo } from "../dashboard/dashboardModel";
import { EASE_OUT, PRIMARY_BUTTON } from "../dashboard/dashboardStyles";
import { CountUp } from "../dashboard/motion";
import { type TailorSection, matchVerdict, tailorSections } from "./tailorModel";
import { type ResumeTailor, useResumeTailor } from "./useResumeTailor";

const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function MatchRing({ score, size = 88 }: { score: number; size?: number }) {
  const stroke = Math.max(6, Math.round(size / 11));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const { label, color } = matchVerdict(score);
  return (
    <div
      role="img"
      aria-label={`${score}% match, ${label.toLowerCase()}`}
      className="relative flex-none"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} style={{ stroke: "var(--track)" }} />
        <motion.circle
          key={score}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ stroke: color }}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - Math.min(100, Math.max(0, score)) / 100) }}
          transition={{ duration: 1.2, ease: EASE_OUT }}
        />
      </svg>
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
        <span className="font-numeric text-foreground" style={{ fontSize: size * 0.26 }}>
          <CountUp value={score} />
          <span className="text-muted-foreground" style={{ fontSize: size * 0.14 }}>
            %
          </span>
        </span>
      </span>
    </div>
  );
}

function KeywordList({ title, keywords, tone }: { title: string; keywords: string[]; tone: "missing" | "matched" }) {
  if (keywords.length === 0) return null;
  const missing = tone === "missing";
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{title}</p>
      <ul aria-label={title} className="flex flex-wrap gap-1.5">
        {keywords.map((keyword, index) => (
          <motion.li
            key={keyword}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: (missing ? 0.15 : 0.25) + index * 0.04 }}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
              missing ? "border-warning/40 bg-warning/10 text-warning" : "border-success/35 bg-success/10 text-success"
            }`}
          >
            {missing ? <Plus size={11} aria-hidden="true" /> : <Check size={11} aria-hidden="true" />}
            {keyword}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function CopyButton({ title, value }: { title: string; value: string }) {
  return (
    <button
      type="button"
      aria-label={`Copy ${title.toLowerCase()}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        toast.success(`${title} copied.`);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-subtle transition-colors hover:bg-secondary"
    >
      <Copy size={11} aria-hidden="true" /> Copy
    </button>
  );
}

function Section({ section, id, index }: { section: TailorSection; id: string; index: number }) {
  const warning = section.tone === "warning";
  return (
    <motion.section
      id={id}
      aria-label={section.title}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06 }}
      className={`scroll-mt-4 rounded-xl border p-4 ${
        warning ? "border-warning/30 bg-warning/[0.05]" : "border-border bg-card"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {warning ? <TriangleAlert size={14} aria-hidden="true" className="text-warning" /> : null}
          {section.title}
        </h4>
        {section.copy ? <CopyButton title={section.title} value={section.copy} /> : null}
      </div>
      {section.text ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{section.text}</p>
      ) : (
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
          {section.items?.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}

function GenerateButton({ tailor }: { tailor: ResumeTailor }) {
  return (
    <button
      type="button"
      onClick={() => void tailor.generate()}
      disabled={!tailor.ready || tailor.generating || tailor.loading}
      className={tailor.analysis ? SECONDARY_BUTTON : PRIMARY_BUTTON}
    >
      <motion.span
        animate={tailor.generating ? { rotate: [0, 18, -18, 0], scale: [1, 1.2, 1] } : { rotate: 0, scale: 1 }}
        transition={tailor.generating ? { duration: 1.2, repeat: Infinity } : { duration: 0.2 }}
      >
        <Sparkles size={14} aria-hidden="true" />
      </motion.span>
      {tailor.generating ? "Analysing…" : tailor.analysis ? "Regenerate" : "Tailor my résumé"}
    </button>
  );
}

function Readiness({
  tailor,
  application,
  canEdit,
}: {
  tailor: ResumeTailor;
  application: JobApplication;
  canEdit: boolean;
}) {
  const link = "text-xs font-medium text-primary hover:text-primary/80";
  const steps = [
    {
      done: tailor.resumeUploaded === true,
      label: "Upload your résumé",
      action: (
        <Link to="/profile" className={link}>
          Go to Profile
        </Link>
      ),
    },
    {
      done: tailor.jobDescriptionReady,
      label: "Add the job description",
      action: canEdit ? (
        <Link to={`/applications/${application.id}/edit`} className={link}>
          Edit application
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">
          Ask {application.owner.display_name.split(" ")[0]} to add it
        </span>
      ),
    },
  ];
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground">See how your résumé matches this role</p>
        <p className="mt-1 text-xs text-muted-foreground">
          AI compares your résumé with the job description and suggests edits. Two things first:
        </p>
      </div>
      <ol aria-label="Before you start" className="space-y-2">
        {steps.map((step, index) => (
          <li key={step.label} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-semibold ${
                step.done ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
              }`}
            >
              {step.done ? <Check size={13} /> : index + 1}
            </span>
            <span className={`flex-1 text-sm ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {step.label}
              {step.done ? <span className="sr-only"> (done)</span> : null}
            </span>
            {step.done ? null : step.action}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Generating() {
  return (
    <div role="status" className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
      <p className="flex items-center gap-2 text-sm text-foreground">
        <motion.span animate={{ rotate: 360 }} transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}>
          <Sparkles size={15} aria-hidden="true" className="text-primary" />
        </motion.span>
        Comparing your résumé with the job description…
      </p>
      <div aria-hidden="true" className="mt-3 space-y-2">
        {[92, 76, 84].map((width, index) => (
          <motion.div
            key={width}
            className="h-2.5 rounded-full bg-primary/15"
            style={{ width: `${width}%` }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: index * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}

function AnalysisView({
  analysis,
  tailor,
  sectionId,
}: {
  analysis: ResumeTailorAnalysis;
  tailor: ResumeTailor;
  sectionId(key: string): string;
}) {
  const { result } = analysis;
  const verdict = matchVerdict(result.match_score);
  const total = result.matched_keywords.length + result.missing_keywords.length;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <MatchRing score={result.match_score} />
          <div className="min-w-0">
            <p className="text-base font-semibold" style={{ color: verdict.color }}>
              {verdict.label}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {result.matched_keywords.length} of {total} key skills found · updated {timeAgo(analysis.updated_at)}
            </p>
          </div>
        </div>
        <GenerateButton tailor={tailor} />
      </div>
      <div className="space-y-3">
        <KeywordList title="Missing from your résumé" keywords={result.missing_keywords} tone="missing" />
        <KeywordList title="Already on your résumé" keywords={result.matched_keywords} tone="matched" />
      </div>
      <div className="space-y-4">
        {tailorSections(result).map((section, index) => (
          <Section key={section.key} section={section} id={sectionId(section.key)} index={index} />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Generated with {analysis.provider_name} · {analysis.model_name}. Review suggestions before using them.
      </p>
    </>
  );
}

/**
 * The AI résumé tailor for one application: a header with jump links, then
 * a checklist, an empty state, a loading state or the analysis.
 */
export function ResumeTailorWorkspace({
  client,
  workspaceId,
  application,
  canEdit,
}: {
  client: ApiClient;
  workspaceId: string;
  application: JobApplication;
  canEdit: boolean;
}) {
  const tailor = useResumeTailor(client, workspaceId, application);
  const idPrefix = useId().replace(/:/g, "");
  const sectionId = (key: string) => `${idPrefix}-tailor-${key}`;
  const sections = tailor.analysis && !tailor.generating ? tailorSections(tailor.analysis.result) : [];

  return (
    <section aria-label="Résumé tailor" className="flex min-h-0 flex-col">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-card/90 px-6 py-3 backdrop-blur">
        <h3 className="mr-auto flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Sparkles size={15} aria-hidden="true" className="text-primary" /> Résumé tailor
        </h3>
        {sections.length ? (
          <nav aria-label="Jump to" className="hidden flex-wrap gap-1.5 xl:flex">
            {sections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() =>
                  document.getElementById(sectionId(section.key))?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {section.shortLabel}
              </button>
            ))}
          </nav>
        ) : null}
      </div>
      <div className="space-y-5 p-6 lg:flex-1 lg:overflow-y-auto">
        {tailor.error ? (
          <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
            {tailor.error}
          </p>
        ) : null}
        {tailor.loading ? (
          <div aria-busy="true" aria-label="Loading résumé analysis" className="h-40 animate-pulse rounded-xl bg-secondary" />
        ) : tailor.generating ? (
          <Generating />
        ) : tailor.analysis ? (
          <AnalysisView analysis={tailor.analysis} tailor={tailor} sectionId={sectionId} />
        ) : !tailor.ready ? (
          <Readiness tailor={tailor} application={application} canEdit={canEdit} />
        ) : (
          <div className="rounded-xl border border-dashed border-primary/40 bg-primary/[0.03] p-6 text-center">
            <Sparkles size={22} aria-hidden="true" className="mx-auto text-primary" />
            <p className="mt-2 text-sm font-medium text-foreground">Ready when you are</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              Get a match score, the keywords you're missing, and résumé lines tailored to this job.
            </p>
            <div className="mt-4">
              <GenerateButton tailor={tailor} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
