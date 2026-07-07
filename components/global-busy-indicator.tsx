"use client";

import { useEffect, useRef, useState } from "react";

const SKIP_PATHS = [
  "/_next/static",
  "/_next/image",
  "/favicon.ico",
];

function shouldTrackRequest(input: RequestInfo | URL, init?: RequestInit) {
  const method = init?.method?.toUpperCase() ?? "GET";
  if (method === "HEAD") {
    return false;
  }

  const headerValue = (headers: HeadersInit | undefined, name: string) => {
    if (!headers) {
      return null;
    }

    if (headers instanceof Headers) {
      return headers.get(name);
    }

    if (Array.isArray(headers)) {
      const match = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
      return match?.[1] ?? null;
    }

    const record = headers as Record<string, string | undefined>;
    const entry = Object.entries(record).find(([key]) => key.toLowerCase() === name.toLowerCase());
    return entry?.[1] ?? null;
  };

  const silentRequest =
    headerValue(init?.headers, "x-nova-silent") === "1" ||
    (input instanceof Request &&
      input.headers.get("x-nova-silent") === "1");

  if (silentRequest) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
      window.location.href,
    );
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin) {
    return false;
  }

  if (SKIP_PATHS.some((prefix) => url.pathname.startsWith(prefix))) {
    return false;
  }

  if (/\.(css|js|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot)$/i.test(url.pathname)) {
    return false;
  }

  return true;
}

export function GlobalBusyIndicator() {
  const [visible, setVisible] = useState(false);
  const pendingCountRef = useRef(0);
  const showTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    function stopTimer() {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    }

    function syncVisibility() {
      if (pendingCountRef.current > 0) {
        if (showTimerRef.current === null) {
          showTimerRef.current = window.setTimeout(() => {
            setVisible(true);
            showTimerRef.current = null;
          }, 180);
        }
        return;
      }

      stopTimer();
      setVisible(false);
    }

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const tracked = shouldTrackRequest(input, init);

      if (tracked) {
        pendingCountRef.current += 1;
        syncVisibility();
      }

      try {
        return await originalFetch(input, init);
      } finally {
        if (tracked) {
          pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
          syncVisibility();
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
      stopTimer();
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/8 px-4 pt-4 backdrop-blur-[1px]"
    >
      <div className="w-full max-w-md rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm font-medium text-slate-800 shadow-lg shadow-slate-900/10 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-600" />
          <span>Procesando...</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-cyan-600" />
        </div>
      </div>
    </div>
  );
}
