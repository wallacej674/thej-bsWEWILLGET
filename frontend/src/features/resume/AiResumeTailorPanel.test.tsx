import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/client";
import type { JobApplication, ResumeTailorAnalysis } from "../applications/types";
import { AiResumeTailorPanel } from "./AiResumeTailorPanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const application: JobApplication = {
  id: "application-1",
  workspace_id: "workspace-1",
  company_name: "Wellfit",
  job_title: "Associate AI Engineer",
  job_posting_url: "https://jobs.example.test/wellfit",
  location: "Dallas, TX",
  work_arrangement: "hybrid",
  employment_type: "full_time",
  application_date: "2026-06-23",
  status: "applied",
  salary_min: null,
  salary_max: null,
  salary_currency: null,
  salary_period: null,
  job_description: "Python APIs prompt engineering Azure OpenAI",
  notes: null,
  created_at: "2026-06-23T12:00:00Z",
  updated_at: "2026-06-23T12:00:00Z",
  owner: { id: "user-1", display_name: "Kareem", avatar_url: null },
};

const analysis: ResumeTailorAnalysis = {
  id: "analysis-1",
  application_id: "application-1",
  prompt_version: "resume-tailor-v1",
  provider_name: "fake",
  model_name: "resume-tailor-test",
  created_at: "2026-06-23T12:00:00Z",
  updated_at: "2026-06-23T12:00:00Z",
  result: {
    match_score: 87,
    matched_keywords: ["Python", "FastAPI"],
    missing_keywords: ["Azure OpenAI"],
    suggested_summary: "Python engineer focused on AI-ready APIs.",
    suggested_bullets: ["Built FastAPI services.", "Tested AI integrations."],
    interview_talking_points: ["Discuss prompt evaluation."],
    caution_notes: ["Do not invent Azure production experience."],
    ats_warnings: ["Missing common resume sections: Projects."],
  },
};

describe("AiResumeTailorPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders for any workspace member, including non-owners", () => {
    const client = {
      get: vi
        .fn()
        .mockRejectedValue(new ApiError(404, "ai_analysis_not_found", "Not found.")),
    };

    render(
      <AiResumeTailorPanel
        client={client as never}
        workspaceId="workspace-1"
        application={application}
      />,
    );

    expect(screen.getByText("AI Resume Tailor")).toBeInTheDocument();
    expect(client.get).toHaveBeenCalled();
  });

  it("generates and renders structured AI resume analysis", async () => {
    const client = {
      get: vi
        .fn()
        .mockRejectedValue(new ApiError(404, "ai_analysis_not_found", "Not found.")),
      post: vi.fn().mockResolvedValue(analysis),
    };

    render(
      <AiResumeTailorPanel
        client={client as never}
        workspaceId="workspace-1"
        application={application}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume with AI" }),
    );

    expect(await screen.findByText("87%")).toBeVisible();
    expect(screen.getByText("Azure OpenAI")).toBeVisible();
    expect(screen.getByText("Python engineer focused on AI-ready APIs.")).toBeVisible();
    expect(screen.getByText("Do not invent Azure production experience.")).toBeVisible();
    expect(client.post).toHaveBeenCalledWith(
      "/workspaces/workspace-1/applications/application-1/ai/resume-tailor",
    );
  });

  it("shows provider or prerequisite errors", async () => {
    const client = {
      get: vi
        .fn()
        .mockRejectedValue(new ApiError(404, "ai_analysis_not_found", "Not found.")),
      post: vi
        .fn()
        .mockRejectedValue(
          new Error("AI resume tailoring is not configured yet."),
        ),
    };

    render(
      <AiResumeTailorPanel
        client={client as never}
        workspaceId="workspace-1"
        application={application}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Tailor resume with AI" }),
    );

    expect(
      await screen.findByText("AI resume tailoring is not configured yet."),
    ).toBeVisible();
  });
});
