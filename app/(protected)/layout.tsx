import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
  const canSeeProduccion = canAccess(permissions, session.Rol, "Producción");
  const canSeeBodega = canAccess(permissions, session.Rol, "Bodega");
  const canSeeUsuarios = canAccess(permissions, session.Rol, "Usuarios");
  const canSeeLog = canAccess(permissions, session.Rol, "Log");
  const canSeePermisos = canAccess(permissions, session.Rol, "Permisos");
  const showConfiguracion = canSeeUsuarios || canSeeLog || canSeePermisos;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-[#f3d2b1] bg-[#2b3a44] px-6 py-8 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#ffb347]">
            NovaApp
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Menú
          </h1>
        </div>

        <nav aria-label="Menú principal" className="space-y-2">
          {canSeeProduccion ? (
            <div className="rounded-2xl border border-[#f3d2b1]/20 bg-white/4 p-3">
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.32em] text-[#f3d2b1]">
                Producción
              </p>
              <Link
                href="/produccion/disponible-otn"
                className="flex items-center justify-between rounded-xl bg-[#ff9200] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#ffb347]"
              >
                <span>Disponible OTN</span>
                <span aria-hidden className="text-white/90">
                  →
                </span>
              </Link>
            </div>
          ) : null}

          {canSeeBodega ? (
            <div className="rounded-2xl border border-[#f3d2b1]/20 bg-white/4 p-3">
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.32em] text-[#f3d2b1]">
                Bodega
              </p>
              <Link
                href="/bodega/stock-actual"
                className="flex items-center justify-between rounded-xl bg-[#ff9200] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#ffb347]"
              >
                <span>Stock Actual</span>
                <span aria-hidden className="text-white/90">
                  →
                </span>
              </Link>
            </div>
          ) : null}

          {showConfiguracion ? (
            <div className="rounded-2xl border border-[#f3d2b1]/20 bg-white/4 p-3">
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.32em] text-[#f3d2b1]">
                Configuración
              </p>
              {canSeeUsuarios ? (
                <Link
                  href="/usuarios"
                  className="flex items-center justify-between rounded-xl bg-[#ff9200] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#ffb347]"
                >
                  <span>Usuarios</span>
                  <span aria-hidden className="text-white/90">
                    →
                  </span>
                </Link>
              ) : null}

              {canSeeLog ? (
                <Link
                  href="/configuracion/log"
                  className={`flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-[#ffb347]/15 ${
                    canSeeUsuarios ? "mt-2" : ""
                  }`}
                >
                  <span>Log</span>
                  <span aria-hidden className="text-[#ffb347]">
                    →
                  </span>
                </Link>
              ) : null}

              {canSeePermisos ? (
                <Link
                  href="/configuracion/permisos"
                  className={`flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-[#ffb347]/15 ${
                    canSeeUsuarios || canSeeLog ? "mt-2" : ""
                  }`}
                >
                  <span>Permisos</span>
                  <span aria-hidden className="text-[#ffb347]">
                    →
                  </span>
                </Link>
              ) : null}
            </div>
          ) : null}
        </nav>

        <div className="mt-10 rounded-2xl border border-[#f3d2b1]/20 bg-white/6 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#f3d2b1]">
            Sesión
          </p>
          <p className="mt-2 text-sm font-medium text-white">
            {session.Nombre}
          </p>
          <p className="text-xs text-white/75">{session.Rol}</p>
          <form action="/api/auth/logout" method="post" className="mt-4">
            <button
              type="submit"
              className="w-full rounded-full border border-[#f3d2b1]/20 bg-[#ff9200] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ffb347]"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 p-6 sm:p-8 lg:p-10">{children}</main>
    </div>
  );
}
