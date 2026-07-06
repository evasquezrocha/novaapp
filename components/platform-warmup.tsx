"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type PlatformWarmupProps = {
  companyKey: string;
  routes: string[];
  apiUrls: string[];
};

const WARMUP_TTL_MS = 5 * 60 * 1000;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function PlatformWarmup({ companyKey, routes, apiUrls }: PlatformWarmupProps) {
  const router = useRouter();

  useEffect(() => {
    const storageKey = `nova:warmup:${companyKey}`;
    const lastRunAt = Number(window.sessionStorage.getItem(storageKey) ?? "0");

    if (Date.now() - lastRunAt < WARMUP_TTL_MS) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const runWarmup = async () => {
      window.sessionStorage.setItem(storageKey, String(Date.now()));

      for (const route of routes) {
        if (cancelled) {
          return;
        }

        try {
          router.prefetch(route);
        } catch {
          // Ignore prefetch errors; the navigation still works normally.
        }

        await delay(120);
      }

      for (const apiUrl of apiUrls) {
        if (cancelled) {
          return;
        }

        try {
          await fetch(apiUrl, {
            method: "GET",
            headers: {
              "x-nova-silent": "1",
            },
            cache: "no-store",
            signal: controller.signal,
          });
        } catch {
          if (controller.signal.aborted) {
            return;
          }
        }

        await delay(250);
      }
    };

    const schedule = () => {
      void runWarmup();
    };

    let idleCallbackId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if ("requestIdleCallback" in window) {
      idleCallbackId = window.requestIdleCallback(schedule, { timeout: 2000 });
    } else {
      timeoutId = globalThis.setTimeout(schedule, 1200);
    }

    return () => {
      cancelled = true;
      controller.abort();

      if ("cancelIdleCallback" in window && idleCallbackId !== null) {
        window.cancelIdleCallback(idleCallbackId);
      }

      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, [apiUrls, companyKey, router, routes]);

  return null;
}
