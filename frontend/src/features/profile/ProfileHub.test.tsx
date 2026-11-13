import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setTheme } from "../../app/theme/themeStore";
import type { MyWeek, Workspace } from "../applications/types";
import { ProfileHub } from "./ProfileHub";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const user = { id: "user-1", display_name: "Jonathan Wallace", avatar_url: null };
const workspace: Workspace = { id: "ws-1", name: "ApplyTogether", role: "owner" };
const otherWorkspace: Workspace = { id: "ws-2", name: "Night School", role: "member" };

const myWeek: MyWeek = {
  weekly_goal: 9,
  applied_this_week: 2,
  streak_weeks: 1,
  day_streak: 2,
  recent_weeks: [],
  oldest_open: null,
  total_active: 3,
  recently_updated: 0,
  total_applied_all_time: 12,
};

const deletedItem = {
  id: "gone-1",
  workspace_id: "ws-1",
  company_name: "Harbor & Pine",
  job_title: "Data Analyst",
  job_posting_url: "https://example.com",
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
  owner: user,
  deleted_at: "2026-11-10T12:00:00Z",
  deleted_by: user,
  moderated: false,
};

function fakeClient() {
  return {
    get: vi.fn(async (path: string) => {
      if (path === "/workspaces/ws-1/applications/my-week") return myWeek;
      if (path === "/workspaces/ws-1/members") {
        return {
          items: [{ user: { ...user, email: "jonathan@example.test" }, role: "owner", joined_at: "" }],
          pagination: { page: 1, page_size: 20, total_items: 1, total_pages: 1 },
          member_count: 1,
        };
      }
      if (path === "/workspaces/ws-1/applications/deleted") {
        return {
          items: [deletedItem],
          pagination: { page: 1, page_size: 10, total_items: 1, total_pages: 1 },
        };
      }
      if (path === "/profile/resume") return null;
      throw new Error(`unexpected GET ${path}`);
    }),
    post: vi.fn(),
  };
}

function renderHub(entry = "/profile", changePassword = vi.fn(() => Promise.resolve())) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ProfileHub
        client={fakeClient() as never}
        user={user}
        workspace={workspace}
        workspaces={[workspace, otherWorkspace]}
        changePassword={changePassword}
        logout={vi.fn(() => Promise.resolve())}
      />
    </MemoryRouter>,
  );
  return { changePassword };
}

describe("ProfileHub", () => {
  afterEach(() => {
    setTheme("light");
  });

  it("introduces the member with their email, role and workspaces", async () => {
    renderHub();

    expect(screen.getByRole("heading", { level: 1, name: "Jonathan Wallace" })).toBeInTheDocument();
    const roleLine = screen.getByText(/Owner of ApplyTogether/);
    await waitFor(() =>
      expect(roleLine).toHaveTextContent("jonathan@example.test · Owner of ApplyTogether"),
    );
    expect(screen.getByText("Sent all-time")).toBeInTheDocument();
    expect(await screen.findByText("/9")).toBeInTheDocument();
    const workspaces = screen.getByRole("region", { name: "Workspaces" });
    expect(within(workspaces).getByText("Night School")).toBeInTheDocument();
    expect(within(workspaces).getByText("Member")).toBeInTheDocument();
  });

  it("previews recently deleted applications and opens the full bin", async () => {
    renderHub();

    expect(await screen.findByText("Recently deleted · 1")).toBeInTheDocument();
    const manage = screen.getByRole("button", { name: /Manage/ });
    fireEvent.click(manage);

    const sheet = await screen.findByRole("dialog", { name: "Recently deleted" });
    expect(await within(sheet).findByText("Harbor & Pine")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: /Select to erase/ })).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(manage).toHaveFocus();
  });

  it("opens the bin straight away for links to the old Deleted page", async () => {
    renderHub("/profile?bin=open");

    expect(await screen.findByRole("dialog", { name: "Recently deleted" })).toBeInTheDocument();
  });

  it("changes the password and rejects one that is too short", async () => {
    const { changePassword } = renderHub();

    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    // The form replaces the summary once the summary has animated out.
    fireEvent.change(await screen.findByLabelText("Current password"), {
      target: { value: "old-password-123" },
    });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Use at least 12 characters");
    expect(changePassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old-password-123" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-much-longer-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: "old-password-123",
        newPassword: "a-much-longer-password",
      }),
    );
  });

  it("switches between light and dark mode", () => {
    renderHub();

    fireEvent.click(screen.getByRole("radio", { name: /Dark/ }));
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByRole("radio", { name: /Dark/ })).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("radio", { name: /Light/ }));
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
