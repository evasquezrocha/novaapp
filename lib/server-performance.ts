import { performance } from "node:perf_hooks";

type MeasureOptions = {
  details?: string;
  logOnSuccess?: boolean;
  slowMs?: number;
};

type ServerTimingEntry = {
  label: string;
  duration: number;
};

const DEFAULT_SLOW_MS = Number(process.env.PERF_SLOW_MS ?? "250");
const PERF_LOG_ENABLED = process.env.PERF_LOG_ENABLED !== "false";
const PERF_VERBOSE = process.env.PERF_VERBOSE === "true";

function formatDuration(duration: number) {
  return duration.toFixed(1);
}

function shouldLog(duration: number, logOnSuccess: boolean, slowMs: number) {
  if (!PERF_LOG_ENABLED) {
    return false;
  }

  if (PERF_VERBOSE || logOnSuccess) {
    return true;
  }

  return duration >= slowMs;
}

export async function measureAsync<T>(
  label: string,
  work: () => Promise<T>,
  options?: MeasureOptions,
): Promise<T> {
  const slowMs = options?.slowMs ?? DEFAULT_SLOW_MS;
  const start = performance.now();

  try {
    const result = await work();
    const duration = performance.now() - start;

    if (shouldLog(duration, options?.logOnSuccess ?? false, slowMs)) {
      const suffix = options?.details ? ` ${options.details}` : "";
      console.info(`[perf] ${label} ${formatDuration(duration)}ms${suffix}`);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - start;
    const suffix = options?.details ? ` ${options.details}` : "";
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[perf] ${label} failed after ${formatDuration(duration)}ms${suffix}: ${message}`);
    throw error;
  }
}

export function createServerTimingContext(route: string) {
  const entries: ServerTimingEntry[] = [];
  const start = performance.now();

  return {
    async measure<T>(label: string, work: () => Promise<T>) {
      const entryStart = performance.now();
      const result = await work();
      entries.push({
        label,
        duration: performance.now() - entryStart,
      });
      return result;
    },
    finalize() {
      entries.push({
        label: "total",
        duration: performance.now() - start,
      });
    },
    apply(response: Response) {
      response.headers.set(
        "Server-Timing",
        entries.map((entry) => `${entry.label};dur=${formatDuration(entry.duration)}`).join(", "),
      );

      if (PERF_LOG_ENABLED && (PERF_VERBOSE || entries.some((entry) => entry.duration >= DEFAULT_SLOW_MS))) {
        console.info(
          `[server-timing] ${route} ${entries
            .map((entry) => `${entry.label}=${formatDuration(entry.duration)}ms`)
            .join(" | ")}`,
        );
      }
    },
  };
}
