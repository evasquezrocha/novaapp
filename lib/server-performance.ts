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

export type PerfSample = {
  id: string;
  source: "operation" | "route";
  label: string;
  durationMs: number;
  details: string | null;
  success: boolean;
  recordedAt: string;
};

export type PerfSummaryRow = {
  source: "operation" | "route";
  label: string;
  count: number;
  errorCount: number;
  averageMs: number;
  maxMs: number;
  lastMs: number;
  lastRecordedAt: string;
};

type PerfStore = {
  samples: PerfSample[];
  nextId: number;
};

const DEFAULT_SLOW_MS = Number(process.env.PERF_SLOW_MS ?? "250");
const PERF_LOG_ENABLED = process.env.PERF_LOG_ENABLED !== "false";
const PERF_VERBOSE = process.env.PERF_VERBOSE === "true";
const PERF_SAMPLE_LIMIT = Math.max(100, Number(process.env.PERF_SAMPLE_LIMIT ?? "500"));

declare global {
  var __novaPerfStore: PerfStore | undefined;
}

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

function getPerfStore(): PerfStore {
  if (!global.__novaPerfStore) {
    global.__novaPerfStore = {
      samples: [],
      nextId: 1,
    };
  }

  return global.__novaPerfStore;
}

function recordSample(input: Omit<PerfSample, "id" | "recordedAt">) {
  const store = getPerfStore();
  const sample: PerfSample = {
    ...input,
    id: String(store.nextId++),
    recordedAt: new Date().toISOString(),
  };

  store.samples.unshift(sample);

  if (store.samples.length > PERF_SAMPLE_LIMIT) {
    store.samples.length = PERF_SAMPLE_LIMIT;
  }
}

function buildRouteDetails(route: string, entries: ServerTimingEntry[]) {
  return `${route} | ${entries
    .map((entry) => `${entry.label}=${formatDuration(entry.duration)}ms`)
    .join(" | ")}`;
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
    recordSample({
      source: "operation",
      label,
      durationMs: duration,
      details: options?.details ?? null,
      success: true,
    });

    if (shouldLog(duration, options?.logOnSuccess ?? false, slowMs)) {
      const suffix = options?.details ? ` ${options.details}` : "";
      console.info(`[perf] ${label} ${formatDuration(duration)}ms${suffix}`);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordSample({
      source: "operation",
      label,
      durationMs: duration,
      details: options?.details ?? null,
      success: false,
    });
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
      const totalEntry = entries.find((entry) => entry.label === "total");
      if (totalEntry) {
        recordSample({
          source: "route",
          label: route,
          durationMs: totalEntry.duration,
          details: buildRouteDetails(route, entries),
          success: true,
        });
      }

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

export function getPerformanceSnapshot() {
  const samples = [...getPerfStore().samples];
  const summaryMap = new Map<string, PerfSummaryRow>();

  for (const sample of samples) {
    const key = `${sample.source}::${sample.label}`;
    const current = summaryMap.get(key);

    if (!current) {
      summaryMap.set(key, {
        source: sample.source,
        label: sample.label,
        count: 1,
        errorCount: sample.success ? 0 : 1,
        averageMs: sample.durationMs,
        maxMs: sample.durationMs,
        lastMs: sample.durationMs,
        lastRecordedAt: sample.recordedAt,
      });
      continue;
    }

    current.count += 1;
    current.errorCount += sample.success ? 0 : 1;
    current.averageMs =
      (current.averageMs * (current.count - 1) + sample.durationMs) / current.count;
    current.maxMs = Math.max(current.maxMs, sample.durationMs);
    current.lastMs = sample.durationMs;
    current.lastRecordedAt = sample.recordedAt;
  }

  const summary = Array.from(summaryMap.values()).sort((a, b) => {
    if (b.averageMs !== a.averageMs) {
      return b.averageMs - a.averageMs;
    }

    return b.count - a.count;
  });

  return {
    capturedAt: new Date().toISOString(),
    sampleLimit: PERF_SAMPLE_LIMIT,
    samples,
    summary,
  };
}
