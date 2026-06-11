import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { getPerformanceSnapshot } from "@/lib/server-performance";
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

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          Configuración
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Monitoreo
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Vista operativa de tiempos recientes del servidor y de las rutas más lentas.
          Los datos se guardan en memoria del proceso actual.
        </p>
      </div>

      <MonitoreoPanel initialSnapshot={snapshot} />
    </section>
  );
}
