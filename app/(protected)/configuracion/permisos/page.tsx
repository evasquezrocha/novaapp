import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { PermisosManager } from "./permisos-manager";

export const dynamic = "force-dynamic";

export default async function PermisosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const permissionRows = await listPermissions();
  if (!canAccess(permissionRows, session.Rol, "Permisos")) {
    redirect("/forbidden");
  }

  const permissions = permissionRows;

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          Configuración
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Permisos
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Aquí puedes definir la estructura de permisos y accesos de la plataforma.
          Esta versión inicial permite administrar roles, módulos y acciones desde una
          matriz editable.
        </p>
      </div>

      <PermisosManager initialPermissions={permissions} />
    </section>
  );
}
