import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";

import { PRIMARY_BUTTON } from "../dashboard/dashboardStyles";

// Matches the backend's MINIMUM_PASSWORD_LENGTH.
const MIN_PASSWORD_LENGTH = 12;

const INPUT =
  "mt-1.5 h-10 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15";

export function PasswordForm({
  changePassword,
  onDone,
}: {
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
  onDone?(): void;
}) {
  const hintId = useId();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for the new password.`);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      toast.success("Password changed. Please sign in again.");
      onDone?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The password could not be changed.");
    } finally {
      setCurrent("");
      setNext("");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <label className="block text-xs font-medium text-subtle">
        Current password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          className={INPUT}
        />
      </label>
      <label className="block text-xs font-medium text-subtle">
        New password
        <input
          type="password"
          autoComplete="new-password"
          required
          aria-describedby={hintId}
          value={next}
          onChange={(event) => setNext(event.target.value)}
          className={INPUT}
        />
      </label>
      <p id={hintId} className="text-xs text-muted-foreground">
        At least {MIN_PASSWORD_LENGTH} characters. Changing it signs you out on every device.
      </p>
      <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
        {saving ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
