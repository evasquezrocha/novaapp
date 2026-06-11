"use client";

import { useEffect, useState } from "react";
import { formatUtcDateTimeInTimeZone } from "@/lib/date-format";
import type { PerfSample, PerfSummaryRow } from "@/lib/server-performance";

type PerfSnapshot = {
  capturedAt: string;
  sampleLimit: number;
  samples: PerfSample[];
  summary: PerfSummaryRow[];
};

function formatMs(value: number) {
  return `${value.toFixed(1)} ms`;
}

function sampleBadgeClass(source: PerfSample["source"]) {
  return source === "route"
    ? "bg-amber-100 text-amber-800"
    : "bg-cyan-100 text-cyan-800";
}

export function MonitoreoPanel({ initialSnapshot }: { initialSnapshot: PerfSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/configuracion/monitoreo", {
        cache: "no-store",
      });
      const payload = (await response.json()) as PerfSnapshot & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible cargar el monitoreo.");
      }

      setSnapshot(payload);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "No fue posible cargar el monitoreo.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
              Estado
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Métricas en vivo
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Última captura:{" "}
              {formatUtcDateTimeInTimeZone(snapshot.capturedAt, "America/Santiago")} | Muestras
              retenidas: {snapshot.sampleLimit}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
            Rutas medidas
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {snapshot.summary.filter((row) => row.source === "route").length}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
            Operaciones medidas
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {snapshot.summary.filter((row) => row.source === "operation").length}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
            Errores capturados
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {snapshot.summary.reduce((sum, row) => sum + row.errorCount, 0)}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
              Resumen
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Más costosos
            </h3>
          </div>
          <p className="text-sm text-slate-500">Ordenado por promedio descendente.</p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Conteo</th>
                <th className="px-4 py-3 font-semibold">Promedio</th>
                <th className="px-4 py-3 font-semibold">Máximo</th>
                <th className="px-4 py-3 font-semibold">Último</th>
                <th className="px-4 py-3 font-semibold">Errores</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {snapshot.summary.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    Aún no hay métricas registradas en este proceso.
                  </td>
                </tr>
              ) : (
                snapshot.summary.slice(0, 20).map((row) => (
                  <tr key={`${row.source}-${row.label}`}>
                    <td className="px-4 py-3 text-slate-700">{row.source}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.label}</td>
                    <td className="px-4 py-3 text-slate-700">{row.count}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMs(row.averageMs)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMs(row.maxMs)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMs(row.lastMs)}</td>
                    <td className="px-4 py-3 text-slate-700">{row.errorCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
              Reciente
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Últimas muestras
            </h3>
          </div>
          <p className="text-sm text-slate-500">Incluye rutas y operaciones.</p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Hora</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Duración</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {snapshot.samples.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Todavía no hay eventos capturados.
                  </td>
                </tr>
              ) : (
                snapshot.samples.slice(0, 50).map((sample) => (
                  <tr key={sample.id}>
                    <td className="px-4 py-3 text-slate-700">
                      {formatUtcDateTimeInTimeZone(sample.recordedAt, "America/Santiago")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${sampleBadgeClass(
                          sample.source,
                        )}`}
                      >
                        {sample.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{sample.label}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMs(sample.durationMs)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {sample.success ? "OK" : "Error"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="max-w-[480px] truncate">{sample.details ?? "-"}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
