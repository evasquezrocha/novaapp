import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { listPerfilTpRows } from "@/lib/perfiles-tp-sql";
import { PerfilesTpManager } from "./perfiles-tp-manager";

export const dynamic = "force-dynamic";

export default async function PerfilesTpPage() {
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

  const rows = await listPerfilTpRows();

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#b45309]">
          ADMINISTRACION
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Perfiles TP
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Cada linea crea una vista publica independiente en /perfil/[codigo].
        </p>
      </div>

      <PerfilesTpManager initialRows={rows} />
    </section>
  );
}

