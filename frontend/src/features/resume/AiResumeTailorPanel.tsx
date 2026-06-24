import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "../../api/client";
import { applicationsApi, type ApiClient } from "../applications/api";
import type {
  JobApplication,
  ResumeTailorAnalysis,
} from "../applications/types";

function ErrorMessage({ error }: { error: string | undefined }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">
      {error}
    </p>
  );
}

export function AiResumeTailorPanel({
  client,
  workspaceId,
  application,
  currentUserId,
}: {
  client: ApiClient;
  workspaceId: string;
  application: JobApplication;
  currentUserId: string;
}) {
  const owned = application.owner.id === currentUserId;
  const [analysis, setAnalysis] = useState<ResumeTailorAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!owned) return;
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    applicationsApi
      .resumeTailorAnalysis(client, workspaceId, application.id)
      .then((result) => {
        if (!cancelled) setAnalysis(result);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.status === 404) {
          setAnalysis(null);
          return;
        }
        setError(
          caught instanceof Error
            ? caught.message
            : "AI analysis could not be loaded.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [application.id, client, owned, workspaceId]);

  if (!owned) return null;

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    setError(undefined);
    try {
      const result = await applicationsApi.generateResumeTailorAnalysis(
        client,
        workspaceId,
        application.id,
      );
      setAnalysis(result);
      toast.success("AI resume analysis generated.");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "AI resume analysis could not be generated.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const copy = async (label: string, value: string) => {
    await navigator.clipboard?.writeText(value);
    toast.success(`${label} copied.`);
  };

  const missingJobDescription =
    !application.job_description || !application.job_description.trim();

  return (
    <section className="rounded-xl border border-indigo-400/15 bg-[#111827] p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            AI Resume Tailor
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Compare your uploaded resume against this job description and get
            role-specific resume guidance.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating || loading || missingJobDescription}
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? "Analyzing..." : analysis ? "Regenerate" : "Tailor resume with AI"}
        </button>
      </div>

      {missingJobDescription ? (
        <p className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
          Add a job description before generating resume tailoring.
        </p>
      ) : null}

      {loading ? (
        <p role="status" className="mt-4 text-sm text-slate-500">
          Checking for existing AI analysis...
        </p>
      ) : null}

      <div className="mt-4 space-y-4">
        <ErrorMessage error={error} />
        {analysis ? (
          <>
            <div className="rounded-xl border border-white/[0.06] bg-[#0c1120] p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Match score
                  </p>
                  <p className="mt-1 text-3xl font-bold text-slate-100">
                    {analysis.result.match_score}%
                  </p>
                </div>
                <p className="max-w-xl text-sm leading-6 text-slate-400">
                  Generated with {analysis.provider_name} / {analysis.model_name}.
                  Review suggestions before adding them to your resume.
                </p>
              </div>
            </div>

            <ResultSection
              title="Matched keywords"
              items={analysis.result.matched_keywords}
            />
            <ResultSection
              title="Missing keywords"
              items={analysis.result.missing_keywords}
            />
            <CopyBlock
              title="Suggested summary"
              value={analysis.result.suggested_summary}
              onCopy={() =>
                void copy("Suggested summary", analysis.result.suggested_summary)
              }
            />
            <CopyList
              title="Suggested bullets"
              items={analysis.result.suggested_bullets}
              onCopy={() =>
                void copy(
                  "Suggested bullets",
                  analysis.result.suggested_bullets.join("\n"),
                )
              }
            />
            <ResultSection
              title="Interview talking points"
              items={analysis.result.interview_talking_points}
            />
            <ResultSection
              title="Caution notes"
              items={analysis.result.caution_notes}
            />
            <ResultSection
              title="ATS warnings"
              items={analysis.result.ats_warnings}
            />
          </>
        ) : !loading ? (
          <p className="rounded-lg border border-white/[0.06] bg-[#0c1120] p-4 text-sm text-slate-500">
            No AI analysis yet. Upload a resume from Profile, make sure this
            application has a job description, then run the tailor.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ResultSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-slate-300"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function CopyBlock({
  title,
  value,
  onCopy,
}: {
  title: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0c1120] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h3>
        <button
          type="button"
          onClick={onCopy}
          className="rounded border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/[0.06]"
        >
          Copy
        </button>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
        {value}
      </p>
    </div>
  );
}

function CopyList({
  title,
  items,
  onCopy,
}: {
  title: string;
  items: string[];
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0c1120] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h3>
        <button
          type="button"
          onClick={onCopy}
          className="rounded border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/[0.06]"
        >
          Copy all
        </button>
      </div>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
