import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InvitationInbox } from "./InvitationInbox";

describe("InvitationInbox", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows inviter display name and accepts the workspace invitation", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        items: [
          {
            id: "invitation-1",
            workspace: { id: "workspace-1", name: "Design search" },
            invited_by: { display_name: "Mina Okafor" },
            invited_at: "2026-06-22T12:00:00Z",
          },
        ],
      }),
      post: vi.fn().mockResolvedValue({
        id: "workspace-1",
        name: "Design search",
        role: "member",
      }),
    };
    const onAccepted = vi.fn().mockResolvedValue(undefined);

    render(
      <InvitationInbox
        client={client as never}
        onAccepted={onAccepted}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Workspace invitations (1)" }),
    );

    expect(screen.getByText("Mina Okafor")).toBeVisible();
    expect(screen.getByText("Design search")).toBeVisible();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    await vi.waitFor(() => {
      expect(client.post).toHaveBeenCalledWith(
        "/invitations/invitation-1/accept",
      );
      expect(onAccepted).toHaveBeenCalledOnce();
    });
  });

  it("does not repeatedly poll invitations in the background", async () => {
    vi.useFakeTimers();
    const client = {
      get: vi.fn().mockResolvedValue({ items: [] }),
    };

    render(
      <InvitationInbox
        client={client as never}
        onAccepted={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await vi.waitFor(() => {
      expect(client.get).toHaveBeenCalledOnce();
    });

    await vi.advanceTimersByTimeAsync(120_000);

    expect(client.get).toHaveBeenCalledOnce();
  });
});
