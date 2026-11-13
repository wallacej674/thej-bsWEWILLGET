import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "../../api/client";
import { type ApiClient, applicationsApi, profileApi } from "../applications/api";
import type { JobApplication, ResumeTailorAnalysis } from "../applications/types";
import { hasJobDescription } from "./tailorModel";

/**
 * Loads the saved résumé analysis for an application (404 means none yet),
 * checks whether a résumé is uploaded, and generates a new analysis.
 */
export function useResumeTailor(client: ApiClient, workspaceId: string, application: JobApplication) {
  const [analysis, setAnalysis] = useState<ResumeTailorAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string>();
  // null = unknown (the check failed); only a confirmed "no résumé" blocks generating.
  const [resumeUploaded, setResumeUploaded] = useState<boolean | null>(null);
  const applicationId = application.id;

  useEffect(() => {
    let cancelled = false;
    setAnalysis(null);
    setError(undefined);
    setLoading(true);
    applicationsApi
      .resumeTailorAnalysis(client, workspaceId, applicationId)
      .then((result) => {
        if (!cancelled) setAnalysis(result);
      })
      .catch((caught: unknown) => {
        if (cancelled || (caught instanceof ApiError && caught.status === 404)) return;
        setError(caught instanceof Error ? caught.message : "The résumé analysis could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    profileApi
      .resume(client)
      .then((resume) => {
        if (!cancelled) setResumeUploaded(Boolean(resume));
      })
      .catch(() => {
        if (!cancelled) setResumeUploaded(null);
      });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId, applicationId]);

  const generate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    setError(undefined);
    try {
      setAnalysis(await applicationsApi.generateResumeTailorAnalysis(client, workspaceId, applicationId));
      toast.success("Résumé analysis ready.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The résumé analysis could not be generated.");
    } finally {
      setGenerating(false);
    }
  }, [client, workspaceId, applicationId, generating]);

  const jobDescriptionReady = hasJobDescription(application);
  return {
    analysis,
    loading,
    generating,
    error,
    generate,
    resumeUploaded,
    jobDescriptionReady,
    ready: resumeUploaded !== false && jobDescriptionReady,
  };
}

export type ResumeTailor = ReturnType<typeof useResumeTailor>;
