import { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../applications/api";

interface SessionInfo {
  id: string;
  user_agent: string | null;
  ip_prefix: string | null;
  created_at: string;
  current: boolean;
}

export function SessionList({ client }: { client: ApiClient }) {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  const load = useCallback(
    () => client.get<SessionInfo[]>("/auth/sessions"),
    [client],
  );
  useEffect(() => {
    let active = true;
    load()
      .then((items) => { if (active) setSessions(items); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [load]);

  async function revoke(id: string) {
    setPending(true);
    setError(false);
    try {
      await client.delete(`/auth/sessions/${id}`);
      setSessions(await load());
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-5 border-t border-border pt-3" aria-label="Active sessions">
      <h3 className="text-sm font-medium">Active sessions</h3>
      {error && <p role="alert">Could not manage sessions. Try again.</p>}
      {sessions === null && !error && <p role="status">Loading sessions…</p>}
      {sessions && (
        <ul className="divide-y divide-border">
          {sessions.map((session) => (
            <li key={session.id} className="py-2 text-sm">
              <p className="break-all">{session.user_agent ?? "Unknown browser"}</p>
              <p className="text-muted-foreground">
                {new Date(session.created_at).toLocaleDateString()}
                {session.ip_prefix && ` · ${session.ip_prefix}`}
                {session.current && " · This session"}
              </p>
              {!session.current && (
                <button className="text-primary underline" type="button" disabled={pending}
                  onClick={() => void revoke(session.id)}>
                  Sign out session
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {sessions?.some((session) => !session.current) && (
        <button className="mt-2 text-sm text-primary underline" type="button"
          disabled={pending} onClick={() => void revoke("others")}>
          Sign out all other sessions
        </button>
      )}
    </section>
  );
}
