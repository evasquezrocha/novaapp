import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { listActivosFijosPageData } from "@/lib/activos-fijos-sql";
import { ActivosFijosManager } from "./activos-fijos-manager";

export const dynamic = "force-dynamic";

export default async function ActivosFijosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Administración")) {
    redirect("/forbidden");
  }

  const { activos, catalogos } = await listActivosFijosPageData();

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          Administración
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Activos Fijos
        </h2>
        <p className="mt-4 max-w-4xl text-base leading-7 text-slate-600">
          Mantén el inventario de activos fijos con sus catálogos asociados.
          Puedes registrar, editar y ampliar tipos de activos, marcas y grupos
          contables desde la misma pantalla.
        </p>
      </div>

      <ActivosFijosManager initialActivos={activos} initialCatalogos={catalogos} />
    </section>
  );
}
