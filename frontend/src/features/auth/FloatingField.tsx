// A text field whose label sits inside it and floats up once the field has
// focus or a value, with a tick that pops in once the field is complete.
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export function FloatingField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  done = false,
  describedBy,
  trailing,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange(value: string): void;
  autoComplete: string;
  /** Shows the completion tick. */
  done?: boolean;
  describedBy?: string;
  /** A control inside the field's right edge, such as Show/Hide. */
  trailing?: ReactNode;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        required
        // A blank placeholder lets CSS tell an empty field from a filled one.
        placeholder=" "
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={describedBy}
        className={`peer h-14 w-full rounded-xl border border-border bg-input px-4 pb-2 pt-6 text-[0.95rem] text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15 ${
          trailing ? "pr-28" : "pr-12"
        }`}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-4 top-2 text-[0.7rem] font-semibold text-muted-foreground transition-all duration-200 ease-out peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[0.95rem] peer-placeholder-shown:font-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[0.7rem] peer-focus:font-semibold peer-focus:text-primary"
      >
        {label}
      </label>
      <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
        <AnimatePresence>
          {done ? (
            <motion.span
              key="done"
              aria-hidden="true"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success)] text-white"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
            >
              <Check size={12} strokeWidth={3} />
            </motion.span>
          ) : null}
        </AnimatePresence>
        {trailing}
      </span>
    </div>
  );
}
