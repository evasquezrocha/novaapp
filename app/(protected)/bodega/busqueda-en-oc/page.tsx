import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { BusquedaEnOcClient } from "./busqueda-en-oc-client";

export const dynamic = "force-dynamic";

export default async function BusquedaEnOcPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Bodega")) {
    redirect("/forbidden");
  }

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          Bodega
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Búsqueda en OC
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Consulta las órdenes de compra abiertas y filtra o ordena por columna.
        </p>

        <BusquedaEnOcClient />
      </div>
    </section>
  );
}
