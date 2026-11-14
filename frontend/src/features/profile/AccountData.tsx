import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ApiError } from "../../api/client";
import type { ApiClient } from "../applications/api";

export function AccountData({ client, onDeleted }: {
  client: ApiClient;
  onDeleted(): Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    try {
      const data = await client.get<unknown>("/users/me/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "applytogether-data.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setError("Could not download your data. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await client.delete("/users/me", { password });
      setPassword("");
      await onDeleted();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Could not delete your account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <Link to="/privacy" className="text-primary underline">Privacy notice</Link>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="text-primary underline" disabled={busy}
          onClick={() => void download()}>Download my data</button>
        <button type="button" className="text-destructive underline" disabled={busy}
          onClick={() => setShowDelete(!showDelete)} aria-expanded={showDelete}>
          {showDelete ? "Cancel" : "Delete account"}
        </button>
      </div>
      {showDelete && (
        <form onSubmit={(event) => void remove(event)} className="space-y-2">
          <label className="block">
            Enter your password to permanently delete your account.
            <input type="password" autoComplete="current-password" required
              className="mt-1 block rounded border border-border bg-background px-2 py-1"
              value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="submit" className="text-destructive underline" disabled={busy}>
            Confirm account deletion
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
