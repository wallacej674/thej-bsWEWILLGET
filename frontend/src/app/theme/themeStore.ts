import { useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark";

// Keep in sync with the inline script in index.html, which applies the saved
// mode before the first paint so the page never flashes the wrong theme.
export const THEME_STORAGE_KEY = "applytogether-theme";

function readStoredTheme(): ThemeMode {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
}

let current: ThemeMode = typeof window === "undefined" ? "light" : readStoredTheme();
const listeners = new Set<() => void>();

export function getTheme(): ThemeMode {
  return current;
}

export function setTheme(mode: ThemeMode) {
  current = mode;
  applyTheme(mode);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable (private windows); the choice still applies.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The active colour mode; re-renders when it changes. */
export function useTheme(): ThemeMode {
  return useSyncExternalStore(subscribe, getTheme, () => "light");
}
