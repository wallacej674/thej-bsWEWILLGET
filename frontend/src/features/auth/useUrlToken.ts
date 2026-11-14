import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

/**
 * Read a one-time token from the URL, then remove it from the address bar
 * (SEC-20), so it doesn't linger in history, screenshots or analytics.
 * The value read on first render is kept for the page's lifetime.
 */
export function useUrlToken(param = "token"): string {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get(param) ?? "");

  useEffect(() => {
    if (!searchParams.has(param)) return;
    const next = new URLSearchParams(searchParams);
    next.delete(param);
    setSearchParams(next, { replace: true });
  }, [param, searchParams, setSearchParams]);

  return token;
}
