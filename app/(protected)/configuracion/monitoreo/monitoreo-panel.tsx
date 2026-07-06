"use client";

import { useEffect, useState } from "react";
import { formatUtcDateTimeInTimeZone } from "@/lib/date-format";
import type { PerfSample, PerfSnapshot, PerfSummaryRow } from "@/lib/server-performance";

function formatMs(value: number) {
  return `${value.toFixed(1)} ms`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

function sampleBadgeClass(source: PerfSample["source"]) {
  return source === "route"
    ? "bg-amber-100 text-amber-800"
    : "bg-cyan-100 text-cyan-800";
}

function statusBadgeClass(success: boolean) {
  return success
    ? "bg-emerald-100 text-emerald-800"
    : "bg-rose-100 text-rose-800";
}

function summaryTypeLabel(source: PerfSummaryRow["source"]) {
  return source === "route" ? "Ruta" : "Operación";
}

function statusLabel(sample: PerfSample) {
  if (sample.status === null) {
    return sample.success ? "OK" : "Error";
  }

  return `HTTP ${sample.status}`;
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
        headers: {
          "x-nova-silent": "1",
        },
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

  const totals = snapshot.totals;
  const slowestSample = totals.slowestSample;
  const latestSample = totals.latestSample;
  const routeRows = snapshot.summary.filter((row) => row.source === "route");
  const operationRows = snapshot.summary.filter((row) => row.source === "operation");

  return (
    <div className="grid gap-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-8 bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 p-8 text-white lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
              Estado
            </p>
            <h3 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Métricas en vivo
            </h3>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200">
              Seguimiento de latencia y errores sobre las rutas y operaciones instrumentadas.
              El snapshot se guarda en memoria del proceso actual.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-inner shadow-slate-950/20">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100/80">
                Última captura
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatUtcDateTimeInTimeZone(snapshot.capturedAt, "America/Santiago")}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-inner shadow-slate-950/20">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100/80">
                Muestras retenidas
              </p>
              <p className="mt-3 text-lg font-semibold text-white">{snapshot.sampleLimit}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-inner shadow-slate-950/20">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100/80">
                Error rate
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatPercent(totals.errorRate)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-inner shadow-slate-950/20">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100/80">
                Muestra más lenta
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {slowestSample ? formatMs(slowestSample.durationMs) : "Sin datos"}
              </p>
              <p className="mt-1 text-xs text-slate-200/80">
                {slowestSample ? slowestSample.label : "Aún no se registran muestras"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50/80 px-8 py-4">
          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
            Eventos: {totals.sampleCount}
          </span>
          <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">
            Rutas: {totals.routeCount}
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Operaciones: {totals.operationCount}
          </span>
          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
            Errores: {totals.errorCount}
          </span>
          <span className="ml-auto text-sm text-slate-500">
            Actualización automática cada 15 segundos.
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
            Total de eventos
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{totals.sampleCount}</p>
          <p className="mt-2 text-sm text-slate-500">Muestras registradas en este proceso.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
            Tasa de error
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {formatPercent(totals.errorRate)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {totals.errorCount} de {totals.sampleCount} eventos.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
            Promedio global
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{formatMs(totals.averageMs)}</p>
          <p className="mt-2 text-sm text-slate-500">Promedio de todas las muestras capturadas.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
            Última muestra
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {latestSample ? formatMs(latestSample.durationMs) : "Sin datos"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {latestSample ? latestSample.label : "Esperando actividad"}
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
          <p className="text-sm text-slate-500">
            Ordenado por promedio descendente, con prioridad para errores.
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Conteo</th>
                <th className="px-4 py-3 font-semibold">Promedio</th>
                <th className="px-4 py-3 font-semibold">Error rate</th>
                <th className="px-4 py-3 font-semibold">Máximo</th>
                <th className="px-4 py-3 font-semibold">Último</th>
                <th className="px-4 py-3 font-semibold">Actualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {snapshot.summary.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={8}>
                    Todavía no hay métricas registradas en este proceso.
                  </td>
                </tr>
              ) : (
                snapshot.summary.slice(0, 20).map((row) => (
                  <tr key={`${row.source}-${row.label}`}>
                    <td className="px-4 py-3 text-slate-700">{summaryTypeLabel(row.source)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.label}</td>
                    <td className="px-4 py-3 text-slate-700">{row.count}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMs(row.averageMs)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatPercent(row.errorRate)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMs(row.maxMs)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMs(row.lastMs)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatUtcDateTimeInTimeZone(row.lastRecordedAt, "America/Santiago")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
                Errores
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                Últimos fallos
              </h3>
            </div>
            <p className="text-sm text-slate-500">Las rutas 4xx/5xx y operaciones fallidas.</p>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Hora</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Duración</th>
                  <th className="px-4 py-3 font-semibold">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {snapshot.recentErrors.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={6}>
                      No hay errores capturados en las muestras más recientes.
                    </td>
                  </tr>
                ) : (
                  snapshot.recentErrors.map((sample) => (
                    <tr key={`error-${sample.id}`}>
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
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(
                            sample.success,
                          )}`}
                        >
                          {statusLabel(sample)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatMs(sample.durationMs)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="max-w-[420px] truncate">{sample.details ?? "-"}</div>
                      </td>
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
                Distribución
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                Rutas vs. operaciones
              </h3>
            </div>
            <p className="text-sm text-slate-500">Separa el consumo por tipo de evento.</p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Rutas
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{totals.routeCount}</p>
              <p className="mt-2 text-sm text-slate-500">
                {routeRows.length} entradas únicas medidas.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Operaciones
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{totals.operationCount}</p>
              <p className="mt-2 text-sm text-slate-500">
                {operationRows.length} operaciones únicas medidas.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Éxitos
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{totals.successCount}</p>
              <p className="mt-2 text-sm text-slate-500">Muestras procesadas sin error.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Fallos
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{totals.errorCount}</p>
              <p className="mt-2 text-sm text-slate-500">Muestras fallidas o con respuesta HTTP.</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            La tarjeta superior muestra el último snapshot, mientras que esta columna resume la
            composición de la carga observada.
          </div>
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
          <p className="text-sm text-slate-500">Incluye rutas, operaciones y código HTTP.</p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Hora</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Duración</th>
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
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(
                          sample.success,
                        )}`}
                      >
                        {statusLabel(sample)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatMs(sample.durationMs)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="max-w-[480px] truncate">{sample.details ?? "-"}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Actualizando..." : "Actualizar ahora"}
          </button>
        </div>
      </div>
    </div>
  );
}
