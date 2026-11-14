import { useEffect, useRef, useState } from "react";

interface Turnstile {
  render(container: HTMLElement, options: {
    sitekey: string;
    action: string;
    callback(token: string): void;
    "expired-callback"(): void;
    "error-callback"(): void;
  }): string;
  remove(id: string): void;
}

const scriptUrl = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<Turnstile> | undefined;

function loadWidget(): Promise<Turnstile> {
  const cloudflare = window as Window & { turnstile?: Turnstile };
  if (cloudflare.turnstile) return Promise.resolve(cloudflare.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => {
      if (cloudflare.turnstile) resolve(cloudflare.turnstile);
      else reject(new Error("Signup challenge unavailable"));
    };
    script.onerror = () => reject(new Error("Signup challenge unavailable"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = undefined;
    document.querySelector(`script[src="${scriptUrl}"]`)?.remove();
    throw error;
  });
  return loading;
}

export function SignupChallenge({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken(token: string | undefined): void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;
    loadWidget().then((widget) => {
      if (!active || !container.current) return;
      const id = widget.render(container.current, {
        sitekey: siteKey,
        action: "signup",
        callback: (token) => { if (active) onToken(token); },
        "expired-callback": () => { if (active) onToken(undefined); },
        "error-callback": () => { if (active) onToken(undefined); },
      });
      cleanup = () => widget.remove(id);
    }).catch(() => { if (active) setUnavailable(true); });
    return () => {
      active = false;
      cleanup?.();
      onToken(undefined);
    };
  }, [siteKey, onToken]);

  return (
    <div className="mt-4">
      <div ref={container} />
      {unavailable && <p role="alert">The security check could not load. Reload to try again.</p>}
    </div>
  );
}
