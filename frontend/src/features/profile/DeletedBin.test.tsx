import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeletedApplication } from "../applications/types";
import { DeletedBin } from "./DeletedBin";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const WORKSPACE = "workspace-1";
const DELETED_PATH = `/workspaces/${WORKSPACE}/applications/deleted`;

function deleted(id: string, company: string): DeletedApplication {
  const owner = { id: "user-1", display_name: "Jonathan", avatar_url: null };
  return {
    id,
    workspace_id: WORKSPACE,
    company_name: company,
    job_title: "Product Analyst",
    job_posting_url: "https://example.com/job",
    location: "Remote",
    work_arrangement: "remote",
    employment_type: "full_time",
    application_date: "2026-11-01",
    status: "applied",
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    salary_period: null,
    job_description: null,
    notes: null,
    created_at: "2026-11-01T12:00:00Z",
    updated_at: "2026-11-01T12:00:00Z",
    owner,
    deleted_at: "2026-11-10T12:00:00Z",
    deleted_by: owner,
    moderated: false,
  };
}

/** A fake API client whose bin holds `items` and shrinks as they are restored. */
function fakeClient(initial: DeletedApplication[]) {
  let items = [...initial];
  const client = {
    get: vi.fn(async (path: string, query: { page: number; page_size: number }) => {
      if (path !== DELETED_PATH) throw new Error(`unexpected GET ${path}`);
      const start = (query.page - 1) * query.page_size;
      return {
        items: items.slice(start, start + query.page_size),
        pagination: {
          page: query.page,
          page_size: query.page_size,
          total_items: items.length,
          total_pages: Math.ceil(items.length / query.page_size),
        },
      };
    }),
    post: vi.fn(async (path: string, body?: { application_ids: string[]; delete_all: boolean }) => {
      const restored = path.match(/applications\/([^/]+)\/restore$/);
      if (restored) {
        items = items.filter((item) => item.id !== restored[1]);
        return items[0];
      }
      if (path.endsWith("/deleted/permanent-delete") && body) {
        const count = body.delete_all ? items.length : body.application_ids.length;
        items = body.delete_all ? [] : items.filter((item) => !body.application_ids.includes(item.id));
        return { deleted_count: count };
      }
      throw new Error(`unexpected POST ${path}`);
    }),
  };
  return client;
}

function renderBin(client: ReturnType<typeof fakeClient>, props: { preview?: boolean } = {}) {
  const onChanged = vi.fn();
  render(<DeletedBin client={client as never} workspaceId={WORKSPACE} onChanged={onChanged} {...props} />);
  return onChanged;
}

describe("DeletedBin", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists deleted applications and restores one", async () => {
    const client = fakeClient([deleted("a", "Lakefront Health"), deleted("b", "Harbor & Pine")]);
    const onChanged = renderBin(client);

    expect(await screen.findByText("Lakefront Health")).toBeInTheDocument();
    expect(screen.getByText("2 deleted · only you can see these")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore Lakefront Health, Product Analyst" }));

    await waitFor(() => expect(screen.queryByText("Lakefront Health")).toBeNull());
    expect(client.post).toHaveBeenCalledWith(`/workspaces/${WORKSPACE}/applications/a/restore`);
    expect(onChanged).toHaveBeenCalled();
  });

  it("erases only the selected applications after confirmation", async () => {
    const client = fakeClient([
      deleted("a", "Lakefront Health"),
      deleted("b", "Harbor & Pine"),
      deleted("c", "Copperline Studio"),
    ]);
    renderBin(client);

    fireEvent.click(await screen.findByRole("button", { name: /Select to erase/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Lakefront Health, Product Analyst" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Copperline Studio, Product Analyst" }));
    fireEvent.click(screen.getByRole("button", { name: /Delete forever/ }));

    expect(window.confirm).toHaveBeenCalledWith(
      "Permanently delete 2 applications? This cannot be undone or restored.",
    );
    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith(`${DELETED_PATH}/permanent-delete`, {
        application_ids: ["a", "c"],
        delete_all: false,
      }),
    );
    expect(await screen.findByText("1 deleted · only you can see these")).toBeInTheDocument();
  });

  it("can erase everything across pages with Select all", async () => {
    const many = Array.from({ length: 12 }, (_, index) => deleted(`id-${index}`, `Company ${index}`));
    const client = fakeClient(many);
    renderBin(client);

    fireEvent.click(await screen.findByRole("button", { name: /Select to erase/ }));
    fireEvent.click(screen.getByRole("button", { name: "Select all 12" }));
    expect(screen.getByText("12 of 12 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Delete forever/ }));

    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith(`${DELETED_PATH}/permanent-delete`, {
        application_ids: [],
        delete_all: true,
      }),
    );
    expect(await screen.findByText("Nothing deleted")).toBeInTheDocument();
  });

  it("keeps everything when the confirmation is cancelled", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const client = fakeClient([deleted("a", "Lakefront Health")]);
    renderBin(client);

    fireEvent.click(await screen.findByRole("button", { name: /Select to erase/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Lakefront Health, Product Analyst" }));
    fireEvent.click(screen.getByRole("button", { name: /Delete forever/ }));

    expect(client.post).not.toHaveBeenCalled();
  });

  it("shows only the newest few, without bulk actions, as a preview", async () => {
    const many = Array.from({ length: 5 }, (_, index) => deleted(`id-${index}`, `Company ${index}`));
    renderBin(fakeClient(many), { preview: true });

    expect(await screen.findByText("Company 0")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Select to erase/ })).toBeNull();
  });

  it("explains an empty bin", async () => {
    renderBin(fakeClient([]));

    expect(await screen.findByText("Nothing deleted")).toBeInTheDocument();
  });
});
