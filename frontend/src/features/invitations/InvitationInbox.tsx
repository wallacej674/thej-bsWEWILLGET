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
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-slate-400 transition hover:border-white/[0.14] hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <Inbox size={15} />
        {items.length > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white">
            {items.length > 9 ? "9+" : items.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          aria-label="Workspace invitation inbox"
          className="absolute right-0 top-10 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/[0.1] bg-[#111827] shadow-[0_24px_70px_rgba(2,6,23,0.58)]"
        >
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Invitations
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Workspace requests sent to your signup email
              </p>
            </div>
            <button
              type="button"
              aria-label="Close invitation inbox"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-slate-200"
            >
              <X size={14} />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-slate-500">
                <LoaderCircle size={14} className="animate-spin" />
                Loading invitations…
              </div>
            ) : error ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-rose-300">
                  Invitations could not be loaded.
                </p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="mt-3 text-xs font-semibold text-indigo-300 hover:text-indigo-200"
                >
                  Try again
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="px-5 py-9 text-center">
                <Inbox size={20} className="mx-auto text-slate-600" />
                <p className="mt-3 text-sm font-medium text-slate-300">
                  No pending invitations
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
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
                      className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"
                    >
                      <p className="text-sm font-semibold text-slate-200">
                        {invitation.invited_by.display_name}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        invited you to{" "}
                        <span className="font-medium text-slate-300">
                          {invitation.workspace.name}
                        </span>
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          aria-label="Decline invitation"
                          disabled={acting}
                          onClick={() => void decline(invitation)}
                          className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-white/[0.09] px-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                        >
                          <X size={12} /> Decline
                        </button>
                        <button
                          type="button"
                          aria-label="Accept invitation"
                          disabled={acting}
                          onClick={() => void accept(invitation)}
                          className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-2 text-xs font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50"
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
