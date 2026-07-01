import { Check, Inbox, LoaderCircle, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  invitationApi,
  type ApiClient,
} from "../applications/api";
import type { InvitationInboxItem } from "../applications/types";

export function InvitationInbox({
  client,
  onAccepted,
}: {
  client: ApiClient;
  onAccepted(): Promise<void>;
}) {
  const [items, setItems] = useState<InvitationInboxItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string>();
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await invitationApi.list(client);
      setItems(response.items);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const accept = async (invitation: InvitationInboxItem) => {
    setActingId(invitation.id);
    try {
      await invitationApi.accept(client, invitation.id);
      setItems((current) =>
        current.filter((item) => item.id !== invitation.id),
      );
      await onAccepted();
      toast.success(`Joined ${invitation.workspace.name}.`);
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "The invitation could not be accepted.",
      );
    } finally {
      setActingId(undefined);
    }
  };

  const decline = async (invitation: InvitationInboxItem) => {
    setActingId(invitation.id);
    try {
      await invitationApi.decline(client, invitation.id);
      setItems((current) =>
        current.filter((item) => item.id !== invitation.id),
      );
      toast.success("Invitation declined.");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "The invitation could not be declined.",
      );
    } finally {
      setActingId(undefined);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Workspace invitations (${items.length})`}
        aria-expanded={open}
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) void load();
        }}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-primary/60 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <Inbox size={15} />
        {items.length > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {items.length > 9 ? "9+" : items.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          aria-label="Workspace invitation inbox"
          className="absolute right-0 top-10 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Invitations
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Workspace requests sent to your signup email
              </p>
            </div>
            <button
              type="button"
              aria-label="Close invitation inbox"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-muted-foreground">
                <LoaderCircle size={14} className="animate-spin" />
                Loading invitations…
              </div>
            ) : error ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-destructive">
                  Invitations could not be loaded.
                </p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="mt-3 text-xs font-semibold text-primary hover:text-[#e0b850]"
                >
                  Try again
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="px-5 py-9 text-center">
                <Inbox size={20} className="mx-auto text-muted-foreground" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  No pending invitations
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  New workspace invitations will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((invitation) => {
                  const acting = actingId === invitation.id;
                  return (
                    <article
                      key={invitation.id}
                      className="rounded-lg border border-border bg-secondary/30 p-3"
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {invitation.invited_by.display_name}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        invited you to{" "}
                        <span className="font-medium text-foreground">
                          {invitation.workspace.name}
                        </span>
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          aria-label="Decline invitation"
                          disabled={acting}
                          onClick={() => void decline(invitation)}
                          className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-border px-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:bg-secondary hover:text-foreground disabled:opacity-50"
                        >
                          <X size={12} /> Decline
                        </button>
                        <button
                          type="button"
                          aria-label="Accept invitation"
                          disabled={acting}
                          onClick={() => void accept(invitation)}
                          className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground transition hover:bg-[#e0b850] active:scale-[0.98] disabled:opacity-50"
                        >
                          {acting ? (
                            <LoaderCircle size={12} className="animate-spin" />
                          ) : (
                            <Check size={12} />
                          )}
                          Accept
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
