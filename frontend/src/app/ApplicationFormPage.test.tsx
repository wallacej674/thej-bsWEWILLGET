import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applicationsApi, type ApiClient } from "../features/applications/api";
import { ApplicationFormPage } from "./App";

const context = {
  client: {} as ApiClient,
  session: {
    user: {
      id: "user-1",
      display_name: "Jonathan",
      avatar_url: null,
    },
    workspace: {
      id: "workspace-1",
      name: "ApplyTogether",
      role: "owner" as const,
    },
  },
  workspaces: [
    {
      id: "workspace-1",
      name: "ApplyTogether",
      role: "owner" as const,
    },
  ],
  switchWorkspace: vi.fn(),
  refreshWorkspaces: vi.fn().mockResolvedValue([]),
  logout: vi.fn().mockResolvedValue(undefined),
  changePassword: vi.fn().mockResolvedValue(undefined),
};

function renderCreateForm() {
  render(
    <MemoryRouter initialEntries={["/applications/new"]}>
      <Routes>
        <Route
          path="/applications/new"
          element={
            <ApplicationFormPage
              context={context}
              mode="create"
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("application form autofill", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("places the job posting URL first and fills empty fields without overwriting typed values", async () => {
    vi.spyOn(applicationsApi, "autofill").mockResolvedValue({
      source: "json_ld",
      fields: {
        company_name: "Autofilled Co",
        job_title: "Backend Engineer",
        location: "Remote",
        job_description: "Build APIs with Python and PostgreSQL.",
      },
      warnings: [],
      field_sources: {},
    });

    renderCreateForm();

    const url = screen.getByLabelText(/job-posting url/i);
    const company = screen.getByLabelText(/company name/i);
    const title = screen.getByLabelText(/job title/i);
    const location = screen.getByLabelText(/location/i);
    const description = screen.getByLabelText(/job description/i);

    expect(url.compareDocumentPosition(company)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    fireEvent.change(url, {
      target: { value: "https://jobs.example.test/backend" },
    });
    fireEvent.change(company, { target: { value: "Manual Company" } });
    fireEvent.click(screen.getByRole("button", { name: /autofill/i }));

    await waitFor(() => {
      expect(title).toHaveValue("Backend Engineer");
    });

    expect(company).toHaveValue("Manual Company");
    expect(location).toHaveValue("Remote");
    expect(description).toHaveValue("Build APIs with Python and PostgreSQL.");
    expect(screen.getByText(/Autofill added the details/i)).toBeVisible();
  });

  it("shows a field error and skips the API when the URL is invalid", () => {
    const autofill = vi.spyOn(applicationsApi, "autofill");

    renderCreateForm();

    fireEvent.change(screen.getByLabelText(/job-posting url/i), {
      target: { value: "not a url" },
    });
    fireEvent.click(screen.getByRole("button", { name: /autofill/i }));

    expect(autofill).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a valid job posting URL.")).toBeVisible();
  });
});
