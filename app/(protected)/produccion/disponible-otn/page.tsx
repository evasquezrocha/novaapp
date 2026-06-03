import { DisponibleOtnClient } from "./disponible-otn-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";

export default async function DisponibleOtnPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Producción")) {
    redirect("/forbidden");
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          Producción
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Disponible OTN
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Consulta en SAP la descripción del proyecto y sus presupuestos a partir
          de un OTN de 6 dígitos.
        </p>
      </div>

      <DisponibleOtnClient />
    </section>
  );
}
