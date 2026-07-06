import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { getNextCtSupervisoresCorrelativo, listCtSupervisoresRows } from "@/lib/ct-supervisores-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { CtSupervisoresManager } from "./ct-supervisores-manager";

export const dynamic = "force-dynamic";

export default async function CtSupervisoresPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  const session = await getSessionUserByToken(token);

  if (!session) {
    redirect("/login");
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Asistencia")) {
    redirect("/forbidden");
  }

  const rows = await listCtSupervisoresRows(session);
  const nextCorrelativo = await getNextCtSupervisoresCorrelativo();

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#b45309]">
          ASISTENCIA
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          CT Supervisores
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Carga uno o varios ingresos en un mismo formulario. El nombre queda fijado al usuario de
          la sesion activa.
        </p>
      </div>

      <CtSupervisoresManager
        sessionName={session.Nombre}
        sessionUser={session.Usuario}
        sessionRole={session.Rol}
        initialRows={rows}
        initialNextCorrelativo={nextCorrelativo}
      />
    </section>
  );
}
