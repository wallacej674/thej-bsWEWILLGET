// Building blocks for the three-step sign-up page.
import { Check, Mail } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Monogram } from "../applications/wall/wallParts";
import { EASE_OUT } from "../dashboard/dashboardStyles";
import { avatarColor, initials } from "../members/avatar";
import { SIGNUP_STAGES, passwordHint, passwordMeter } from "./signupModel";

/** You → Password → Workspace → Verify, with the current stage marked. */
export function SignupStepper({ active }: { active: number }) {
  return (
    <ol className="mb-8 flex items-center" aria-label="Sign-up progress">
      {SIGNUP_STAGES.map((label, index) => {
        const done = index < active;
        const current = index === active;
        const lit = done || current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <motion.span
                className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold"
                initial={false}
                animate={{
                  backgroundColor: lit ? "var(--primary)" : "var(--card)",
                  borderColor: lit ? "var(--primary)" : "var(--border)",
                  color: lit ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  scale: current ? 1.1 : 1,
                }}
                transition={{ duration: 0.3 }}
                aria-current={current ? "step" : undefined}
              >
                {current ? (
                  <motion.span
                    aria-hidden="true"
                    className="absolute -inset-1.5 rounded-full border-2 border-primary/30"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0.3, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                ) : null}
                {done ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : <span aria-hidden="true">{index + 1}</span>}
              </motion.span>
              <span className={`text-[11px] font-semibold ${current ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
                <span className="sr-only">{done ? ", done" : current ? ", current step" : ""}</span>
              </span>
            </div>
            {index < SIGNUP_STAGES.length - 1 ? (
              <span aria-hidden="true" className="relative mx-2 mb-5 h-0.5 flex-1 overflow-hidden rounded-full bg-[var(--track)]">
                <motion.span
                  className="absolute inset-0 origin-left bg-primary"
                  initial={false}
                  animate={{ scaleX: done ? 1 : 0 }}
                  transition={{ duration: 0.45, ease: EASE_OUT }}
                />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Error or helper text under a field, sliding in and out. */
export function FieldMessage({ id, error, helper }: { id: string; error?: string; helper?: string }) {
  const text = error ?? helper;
  return (
    <AnimatePresence initial={false} mode="wait">
      {text ? (
        <motion.span
          key={error ? `error-${error}` : `helper-${helper}`}
          id={id}
          className={`mt-1.5 block text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {text}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

/** A four-part length meter under the password field. */
export function PasswordMeter({ password }: { password: string }) {
  const fills = passwordMeter(password.length);
  const color =
    fills[3] === 1 ? "var(--success)" : fills[2] === 1 ? "var(--primary)" : "var(--warning)";
  return (
    <div className="mt-2">
      <div aria-hidden="true" className="flex gap-1">
        {fills.map((fill, segment) => (
          <span key={segment} className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--track)]">
            <motion.span
              className="block h-full origin-left rounded-full"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: fill, backgroundColor: color }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
            />
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{passwordHint(password.length)}</p>
    </div>
  );
}

/** One live password requirement, ticking when it's met. */
export function Requirement({ met, children }: { met: boolean; children: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <motion.span
        aria-hidden="true"
        className="flex h-5 w-5 flex-none items-center justify-center rounded-full border"
        initial={false}
        animate={{
          backgroundColor: met ? "var(--success)" : "rgba(0,0,0,0)",
          borderColor: met ? "var(--success)" : "var(--border)",
          scale: met ? [1, 1.25, 1] : 1,
        }}
        transition={{ duration: 0.3 }}
      >
        {met ? <Check size={12} strokeWidth={3} className="text-white" /> : null}
      </motion.span>
      <span className={met ? "text-foreground" : "text-muted-foreground"}>
        {children}
        <span className="sr-only">{met ? " (done)" : " (not yet)"}</span>
      </span>
    </li>
  );
}

/** A preview of the workspace being created, updating as it's named. */
export function WorkspacePreview({ workspaceName, displayName }: { workspaceName: string; displayName: string }) {
  const name = workspaceName.trim();
  const person = displayName.trim() || "You";
  return (
    <div aria-hidden="true" className="mt-5 rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Preview</p>
      <div className="flex items-center gap-3">
        <motion.span key={name || "placeholder"} initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}>
          <Monogram name={name || "Workspace"} size={40} />
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className={`truncate font-semibold ${name ? "text-foreground" : "text-muted-foreground"}`}>
            {name || "Your workspace"}
          </p>
          <p className="text-xs text-muted-foreground">1 member · Owner</p>
        </div>
        <span
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-card"
          style={{ background: avatarColor(person) }}
        >
          {initials(person)}
        </span>
      </div>
    </div>
  );
}

/** An envelope that drops in and bobs, for the check-your-email screen. */
export function MailBadge() {
  return (
    <motion.span
      aria-hidden="true"
      className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_18px_44px_-14px_var(--primary)]"
      initial={{ y: -40, opacity: 0, rotate: -12, scale: 0.7 }}
      animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 16 }}
    >
      <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}>
        <Mail size={33} />
      </motion.span>
    </motion.span>
  );
}

/** "Send again in Ns" with the wait draining away, then "Send a new link". */
export function ResendButton({
  seconds,
  total,
  pending,
  onResend,
}: {
  seconds: number;
  total: number;
  pending: boolean;
  onResend: () => void;
}) {
  const waiting = seconds > 0;
  return (
    <button
      type="button"
      onClick={onResend}
      disabled={pending || waiting}
      className="relative h-12 w-full overflow-hidden rounded-xl border border-primary/30 bg-primary/10 px-4 text-[0.95rem] font-semibold text-primary transition hover:bg-primary/15 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-80"
    >
      {waiting ? (
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-primary/10"
          initial={false}
          animate={{ width: `${Math.min(1, seconds / total) * 100}%` }}
          transition={{ duration: 1, ease: "linear" }}
        />
      ) : null}
      <span className="relative">
        {pending
          ? "Sending new link…"
          : waiting
            ? `Send again in ${seconds <= 60 ? `${seconds}s` : `${Math.ceil(seconds / 60)} min`}`
            : "Send a new link"}
      </span>
    </button>
  );
}
