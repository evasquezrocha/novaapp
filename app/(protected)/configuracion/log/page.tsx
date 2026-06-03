import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE_NAME,
  getSessionUserByToken,
  listAccessLogs,
} from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";

export const dynamic = "force-dynamic";

function formatIp(value: string | null) {
  return value?.trim() ? value : "-";
}

export default async function LogPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Log")) {
    redirect("/forbidden");
  }

  const rows = await listAccessLogs(100);

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          Configuración
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Log de accesos
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Registro de ingresos exitosos a la plataforma con fecha, hora e IP cuando
          está disponible.
        </p>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Usuario</th>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Fecha y hora</th>
              <th className="px-4 py-3 font-semibold">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={4}>
                  No hay registros de acceso todavía.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.Id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {row.Usuario}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.Nombre}</td>
                  <td className="px-4 py-3 text-slate-700">{row.AccedidoEn}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatIp(row.DireccionIp)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
