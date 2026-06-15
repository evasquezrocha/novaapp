import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { getPerformanceSnapshot } from "@/lib/server-performance";
import { formatUtcDateTimeInTimeZone } from "@/lib/date-format";
import { MonitoreoPanel } from "./monitoreo-panel";

export const dynamic = "force-dynamic";

export default async function MonitoreoPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Monitoreo")) {
    redirect("/forbidden");
  }

  const snapshot = getPerformanceSnapshot();
  const totals = snapshot.totals;
  const slowest = totals.slowestSample;
  const latest = totals.latestSample;

  return (
    <section className="grid gap-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-8 bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 p-8 text-white lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
              Configuración
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight">Monitoreo</h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200">
              Vista operativa de los tiempos recientes del servidor y de las rutas más costosas.
              Los datos se conservan en memoria del proceso actual.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100/80">
                Snapshot
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatUtcDateTimeInTimeZone(snapshot.capturedAt, "America/Santiago")}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100/80">
                Muestras
              </p>
              <p className="mt-3 text-lg font-semibold text-white">{totals.sampleCount}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100/80">
                Error rate
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {(totals.errorRate * 100).toFixed(1)}%
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100/80">
                Límite
              </p>
              <p className="mt-3 text-lg font-semibold text-white">{snapshot.sampleLimit}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t border-slate-200 bg-slate-50/80 p-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Muestra más lenta
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {slowest ? `${slowest.durationMs.toFixed(1)} ms` : "Sin datos"}
            </p>
            <p className="mt-2 text-sm text-slate-500">{slowest?.label ?? "Esperando eventos"}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Última muestra
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {latest ? `${latest.durationMs.toFixed(1)} ms` : "Sin datos"}
            </p>
            <p className="mt-2 text-sm text-slate-500">{latest?.label ?? "Sin actividad"}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Última actualización
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {formatUtcDateTimeInTimeZone(snapshot.capturedAt, "America/Santiago")}
            </p>
            <p className="mt-2 text-sm text-slate-500">Lectura basada en memoria del proceso.</p>
          </div>
        </div>
      </div>

      <MonitoreoPanel initialSnapshot={snapshot} />
    </section>
  );
}
