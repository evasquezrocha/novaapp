import { listUsuarios } from "@/lib/usuarios-sql";
import { listRoles } from "@/lib/roles-sql";
import { UsuariosManager } from "./usuarios-manager";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Usuarios")) {
    redirect("/forbidden");
  }

  const rows = await listUsuarios();
  const roles = await listRoles();

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          Administración
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Usuarios
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Gestión de usuarios almacenados en la base de aplicación definida por
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-900">
            SQL_DATABASE
          </code>
          .
        </p>

        <UsuariosManager initialUsers={rows} initialRoles={roles} />
      </div>
    </section>
  );
}
