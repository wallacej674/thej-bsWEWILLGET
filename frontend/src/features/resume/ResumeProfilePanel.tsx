import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "../../api/client";
import { profileApi, type ApiClient } from "../applications/api";
import type { ResumeProfile } from "../applications/types";

function statusLabel(status: ResumeProfile["parser_status"]): string {
  if (status === "ready") return "ATS readable";
  if (status === "warning") return "Review formatting";
  return "Unreadable";
}

export function ResumeProfilePanel({ client }: { client: ApiClient }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [resume, setResume] = useState<ResumeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setResume(await profileApi.resume(client));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Resume could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    setError(undefined);
    try {
      const uploaded = await profileApi.uploadResume(client, file);
      setResume(uploaded);
      toast.success("Resume uploaded.");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Resume could not be uploaded.",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    setError(undefined);
    try {
      await profileApi.deleteResume(client);
      setResume(null);
      toast.success("Resume removed.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Resume could not be removed.",
      );
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-white/[0.08] bg-[#111827] p-6">
      <div className="flex flex-col justify-between gap-4 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-start">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            AI resume profile
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Upload a PDF resume. ApplyTogether extracts ATS-readable text and
            discards the original file.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-4 py-2 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-500/15">
          {uploading ? "Uploading..." : resume ? "Replace PDF" : "Upload PDF"}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => void upload(event)}
            disabled={uploading}
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p role="status" className="mt-4 text-sm text-slate-500">
          Loading resume...
        </p>
      ) : resume ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-200">
              {resume.original_filename}
            </span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
              {statusLabel(resume.parser_status)}
            </span>
            <span className="text-xs text-slate-500">
              {resume.extracted_text_length.toLocaleString()} readable characters
            </span>
          </div>
          {resume.parser_warnings.length > 0 ? (
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
                ATS diagnostics
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100/85">
                {resume.parser_warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Your resume text looks readable for AI tailoring.
            </p>
          )}
          <details className="rounded-lg border border-white/[0.06] bg-[#0c1120] p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-400">
              Extracted text preview
            </summary>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {resume.extracted_text_preview}
            </p>
          </details>
          <button
            type="button"
            className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"
            onClick={() => void remove()}
          >
            Remove resume
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          No resume uploaded yet. Add one before generating AI resume tailoring.
        </p>
      )}
    </section>
  );
}
