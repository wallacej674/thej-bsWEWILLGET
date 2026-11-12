import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { ApplicationFilters, JobApplication } from "../types";
import { CompanyWall } from "./CompanyWall";

const jonathan = { id: "jonathan-id", display_name: "Jonathan Wallace", avatar_url: null };
const kareem = { id: "kareem-id", display_name: "Kareem Ali", avatar_url: null };

function application(id: string, company: string, owner = jonathan): JobApplication {
  return {
    id,
    workspace_id: "workspace",
    company_name: company,
    job_title: "Product Analyst",
    job_posting_url: "https://example.com/job",
    location: "Remote",
    work_arrangement: "remote",
    employment_type: "full_time",
    application_date: "2026-11-09",
    status: "applied",
    salary_min: "90000",
    salary_max: "110000",
    salary_currency: "USD",
    salary_period: "yearly",
    job_description: "Analyse the product funnel.",
    notes: "Recruiter screen booked.",
    created_at: "2026-11-09T12:00:00Z",
    updated_at: "2026-11-10T12:00:00Z",
    owner,
  };
}

const filters: ApplicationFilters = {
  search: "",
  ownerId: "",
  status: "",
  workArrangement: "",
  employmentType: "",
  sortBy: "application_date",
  sortOrder: "desc",
  page: 1,
  pageSize: 10,
};

function renderWall(
  overrides: Partial<Parameters<typeof CompanyWall>[0]> = {},
) {
  const props: Parameters<typeof CompanyWall>[0] = {
    applications: [
      application("app-1", "Lakefront Health"),
      application("app-2", "Harbor & Pine", kareem),
    ],
    pagination: { page: 1, page_size: 10, total_items: 2, total_pages: 1 },
    loading: false,
    error: null,
    filters,
    facets: {
      statusCounts: { applied: 2, rejected: 0, withdrawn: 0, closed: 0 },
      owners: [jonathan, kareem],
      total: 2,
    },
    userId: jonathan.id,
    canModerate: false,
    onFiltersChange: vi.fn(),
    onClearFilters: vi.fn(),
    onDelete: vi.fn(() => Promise.resolve(true)),
    ...overrides,
  };
  render(
    <MemoryRouter>
      <CompanyWall {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe("CompanyWall", () => {
  it("shows a tile per application", () => {
    renderWall();

    expect(screen.getByRole("heading", { name: /Applications/ })).toBeInTheDocument();
    // Tiles fade in, so assert presence rather than visibility.
    expect(
      screen.getByRole("button", { name: /^Lakefront Health, Product Analyst/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Harbor & Pine, Product Analyst/ }),
    ).toBeInTheDocument();
  });

  it("opens an application's details and closes them again", async () => {
    renderWall();

    fireEvent.click(screen.getByRole("button", { name: /^Lakefront Health/ }));

    const dialog = await screen.findByRole("dialog", { name: "Lakefront Health" });
    expect(dialog).toHaveTextContent("Recruiter screen booked.");
    expect(dialog).toHaveTextContent("$90K–$110K/yr");
    expect(screen.getByRole("link", { name: "Open full record" })).toHaveAttribute(
      "href",
      "/applications/app-1",
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /^Lakefront Health/ })).toHaveFocus();
  });

  it("offers edit to the author and delete to the author or a moderator", async () => {
    renderWall();

    fireEvent.click(screen.getByRole("button", { name: /^Harbor & Pine/ }));
    await screen.findByRole("dialog", { name: "Harbor & Pine" });
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /^Lakefront Health/ }));
    await screen.findByRole("dialog", { name: "Lakefront Health" });
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/applications/app-1/edit",
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
  });

  it("lets a moderator delete someone else's application", async () => {
    const props = renderWall({ canModerate: true });

    fireEvent.click(screen.getByRole("button", { name: /^Harbor & Pine/ }));
    await screen.findByRole("dialog", { name: "Harbor & Pine" });
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(props.onDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: "app-2", company_name: "Harbor & Pine" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("filters by status from the pills", () => {
    const props = renderWall();

    fireEvent.click(screen.getByRole("button", { name: /^Rejected/ }));

    expect(props.onFiltersChange).toHaveBeenCalledWith({ status: "rejected" });
  });

  it("offers to clear filters when nothing matches", () => {
    const props = renderWall({
      applications: [],
      pagination: { page: 1, page_size: 10, total_items: 0, total_pages: 0 },
      filters: { ...filters, status: "closed" },
    });

    expect(screen.getByText("No applications match these filters")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(props.onClearFilters).toHaveBeenCalled();
  });

  it("shows placeholders before the first page loads", () => {
    renderWall({ applications: null, pagination: null, loading: true });

    expect(screen.getByLabelText("Loading applications")).toBeInTheDocument();
  });
});
