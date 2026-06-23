import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResumeProfilePanel } from "./ResumeProfilePanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const resume = {
  id: "resume-1",
  original_filename: "kareem.pdf",
  parser_status: "warning",
  parser_warnings: ["Missing common resume sections: Projects."],
  extracted_text_preview: "Experience Python FastAPI\nSkills TypeScript SQL",
  extracted_text_length: 4200,
  created_at: "2026-06-23T12:00:00Z",
  updated_at: "2026-06-23T12:00:00Z",
};

describe("ResumeProfilePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the current resume and shows ATS diagnostics", async () => {
    const client = {
      get: vi.fn().mockResolvedValue(resume),
    };

    render(<ResumeProfilePanel client={client as never} />);

    expect(await screen.findByText("kareem.pdf")).toBeVisible();
    expect(screen.getByText("Review formatting")).toBeVisible();
    expect(
      screen.getByText("Missing common resume sections: Projects."),
    ).toBeVisible();
    expect(screen.getByText(/4,200 readable characters/)).toBeVisible();
  });

  it("uploads a replacement PDF resume", async () => {
    const client = {
      get: vi.fn().mockResolvedValue(null),
      post: vi.fn().mockResolvedValue({ ...resume, original_filename: "new.pdf" }),
    };
    const file = new File(["pdf"], "new.pdf", { type: "application/pdf" });

    render(<ResumeProfilePanel client={client as never} />);

    const input = await screen.findByLabelText("Upload PDF");
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("new.pdf")).toBeVisible();
    const formData = client.post.mock.calls[0][1] as FormData;
    expect(client.post).toHaveBeenCalledWith("/profile/resume", formData);
    expect(formData.get("file")).toBe(file);
  });

  it("deletes the uploaded resume", async () => {
    const client = {
      get: vi.fn().mockResolvedValue(resume),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    render(<ResumeProfilePanel client={client as never} />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove resume" }));

    await vi.waitFor(() => {
      expect(client.delete).toHaveBeenCalledWith("/profile/resume");
    });
    expect(await screen.findByText(/No resume uploaded yet/)).toBeVisible();
  });
});
