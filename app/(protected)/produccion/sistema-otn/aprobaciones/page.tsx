import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { listSistemaOtnAprobacionesRows } from "@/lib/sistema-otn-aprobaciones-sql";
import { AprobacionesClient } from "./aprobaciones-client";

export const dynamic = "force-dynamic";

export default async function SistemaOtnAprobacionesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Sistema OTN")) {
    redirect("/forbidden");
  }

  const rows = await listSistemaOtnAprobacionesRows();

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-700">
          Sistema OTN
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Aprobaciones
        </h2>
        <p className="mt-4 max-w-4xl text-base leading-7 text-slate-600">
          Ingresa una OTN para ver su detalle completo y crear la aprobación asociada
          en la misma pantalla.
        </p>
      </div>

      <AprobacionesClient initialRows={rows} />
    </section>
  );
}
