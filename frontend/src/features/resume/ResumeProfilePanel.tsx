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
    <section className="mt-6 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-start">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            AI resume profile
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Upload a PDF resume. ApplyTogether extracts ATS-readable text and
            discards the original file.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-[#e0b850] transition hover:bg-primary/15">
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
        <p role="alert" className="mt-4 text-sm text-[#f0a9a3]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Loading resume...
        </p>
      ) : resume ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-foreground">
              {resume.original_filename}
            </span>
            <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#e0b850]">
              {statusLabel(resume.parser_status)}
            </span>
            <span className="text-xs text-muted-foreground">
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
            <p className="text-sm text-muted-foreground">
              Your resume text looks readable for AI tailoring.
            </p>
          )}
          <details className="rounded-lg border border-border bg-input p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Extracted text preview
            </summary>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#cdbfa3]">
              {resume.extracted_text_preview}
            </p>
          </details>
          <button
            type="button"
            className="rounded-lg border border-[#e0625a]/25 px-3 py-2 text-xs font-semibold text-[#e0625a] hover:bg-[#e0625a]/10"
            onClick={() => void remove()}
          >
            Remove resume
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          No resume uploaded yet. Add one before generating AI resume tailoring.
        </p>
      )}
    </section>
  );
}
