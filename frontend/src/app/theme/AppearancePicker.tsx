import type { ReactNode } from "react";
import { Check, Moon, Sun } from "lucide-react";

import { type ThemeMode, setTheme, useTheme } from "./themeStore";

// Fixed preview colours: each swatch shows that mode, whatever is active.
const OPTIONS: {
  mode: ThemeMode;
  label: string;
  icon: ReactNode;
  page: string;
  card: string;
  text: string;
}[] = [
  { mode: "light", label: "Light", icon: <Sun size={14} />, page: "#f6f7f9", card: "#ffffff", text: "#0f172a" },
  { mode: "dark", label: "Dark", icon: <Moon size={14} />, page: "#09090b", card: "#131316", text: "#f4f4f5" },
];

/** Light/dark choice shown as clickable previews; same setting as the top-bar toggle. */
export function AppearancePicker() {
  const theme = useTheme();
  return (
    <div role="radiogroup" aria-label="Colour mode" className="grid grid-cols-2 gap-3">
      {OPTIONS.map((option) => {
        const on = theme === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setTheme(option.mode)}
            className={`rounded-xl border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              on ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"
            }`}
          >
            <span aria-hidden="true" className="block rounded-lg p-2" style={{ background: option.page }}>
              <span className="block rounded-md p-2" style={{ background: option.card }}>
                <span className="block h-1.5 w-10 rounded-full" style={{ background: option.text, opacity: 0.8 }} />
                <span className="mt-1.5 block h-1.5 w-16 rounded-full" style={{ background: option.text, opacity: 0.3 }} />
                <span className="mt-2 block h-3 w-8 rounded bg-primary" />
              </span>
            </span>
            <span className="mt-2 flex items-center justify-between px-1 text-xs font-medium text-foreground">
              <span className="flex items-center gap-1.5">
                {option.icon} {option.label}
              </span>
              {on ? <Check size={13} aria-hidden="true" className="text-primary" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
