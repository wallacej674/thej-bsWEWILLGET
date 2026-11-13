import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/client";
import type { JobApplication, ResumeTailorAnalysis } from "../applications/types";
import { ResumeTailorWorkspace } from "./ResumeTailorWorkspace";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ANALYSIS_PATH = "/workspaces/workspace-1/applications/application-1/ai/resume-tailor";

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
  owner: { id: "user-1", display_name: "Kareem Ali", avatar_url: null },
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

const notFound = () => new ApiError(404, "ai_analysis_not_found", "Not found.");

/** A fake client: `saved` is the stored analysis (null = 404), `resume` the profile résumé. */
function fakeClient({
  saved = null as ResumeTailorAnalysis | null,
  resume = { id: "resume-1" } as unknown,
  generate = vi.fn().mockResolvedValue(analysis),
} = {}) {
  return {
    get: vi.fn(async (path: string) => {
      if (path === ANALYSIS_PATH) {
        if (saved) return saved;
        throw notFound();
      }
      if (path === "/profile/resume") return resume;
      throw new Error(`unexpected GET ${path}`);
    }),
    post: generate,
  };
}

function renderWorkspace(
  client: ReturnType<typeof fakeClient>,
  props: { application?: JobApplication; canEdit?: boolean } = {},
) {
  render(
    <MemoryRouter>
      <ResumeTailorWorkspace
        client={client as never}
        workspaceId="workspace-1"
        application={props.application ?? application}
        canEdit={props.canEdit ?? true}
      />
    </MemoryRouter>,
  );
}

describe("ResumeTailorWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("shows a saved analysis with its score, keywords and sections", async () => {
    renderWorkspace(fakeClient({ saved: analysis }));

    expect(await screen.findByRole("img", { name: "87% match, strong match" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Missing from your résumé" })).getByText("Azure OpenAI")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Already on your résumé" })).getByText("FastAPI")).toBeInTheDocument();
    expect(screen.getByText("Python engineer focused on AI-ready APIs.")).toBeInTheDocument();
    expect(screen.getByText("Do not invent Azure production experience.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Regenerate/ })).toBeEnabled();
  });

  it("generates an analysis when there is none yet", async () => {
    const client = fakeClient();
    renderWorkspace(client);

    fireEvent.click(await screen.findByRole("button", { name: /Tailor my résumé/ }));

    expect(await screen.findByText("Python engineer focused on AI-ready APIs.")).toBeInTheDocument();
    expect(client.post).toHaveBeenCalledWith(ANALYSIS_PATH);
  });

  it("shows provider or prerequisite errors", async () => {
    renderWorkspace(
      fakeClient({ generate: vi.fn().mockRejectedValue(new Error("AI resume tailoring is not configured yet.")) }),
    );

    fireEvent.click(await screen.findByRole("button", { name: /Tailor my résumé/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("AI resume tailoring is not configured yet.");
  });

  it("lists what is missing before it can run", async () => {
    renderWorkspace(fakeClient({ resume: null }), {
      application: { ...application, job_description: null },
      canEdit: false,
    });

    const steps = await screen.findByRole("list", { name: "Before you start" });
    expect(within(steps).getByRole("link", { name: "Go to Profile" })).toHaveAttribute("href", "/profile");
    expect(within(steps).getByText("Ask Kareem to add it")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tailor my résumé/ })).toBeNull();
  });

  it("links the owner to editing the job description", async () => {
    renderWorkspace(fakeClient(), { application: { ...application, job_description: "" } });

    const steps = await screen.findByRole("list", { name: "Before you start" });
    expect(within(steps).getByRole("link", { name: "Edit application" })).toHaveAttribute(
      "href",
      "/applications/application-1/edit",
    );
    expect(within(steps).getByText("(done)", { exact: false })).toBeInTheDocument();
  });

  it("works for any workspace member, even if the résumé check fails", async () => {
    const client = fakeClient();
    client.get.mockImplementation(async (path: string) => {
      if (path === ANALYSIS_PATH) throw notFound();
      throw new Error("network down");
    });
    renderWorkspace(client, { canEdit: false });

    expect(await screen.findByRole("button", { name: /Tailor my résumé/ })).toBeEnabled();
  });

  it("copies the suggested bullets", async () => {
    renderWorkspace(fakeClient({ saved: analysis }));

    fireEvent.click(await screen.findByRole("button", { name: "Copy suggested bullets" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Built FastAPI services.\nTested AI integrations.");
  });
});
