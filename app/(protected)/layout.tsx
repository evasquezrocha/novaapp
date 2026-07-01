import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { getActiveSapCompany } from "@/lib/sap-stock";
import { CompanySwitcher } from "@/components/company-switcher";
import { PlatformWarmup } from "@/components/platform-warmup";
import { SessionCard } from "@/components/session-card";
import { SidebarNav } from "@/components/sidebar-nav";

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
  const company = await getActiveSapCompany();
  const canSeeProduccion = canAccess(permissions, session.Rol, "Producción");
  const canSeeSistemaOtn = canAccess(permissions, session.Rol, "Sistema OTN");
  const canSeeBodega = canAccess(permissions, session.Rol, "Bodega");
  const canSeeUsuarios = canAccess(permissions, session.Rol, "Usuarios");
  const canSeeLog = canAccess(permissions, session.Rol, "Log");
  const canSeeMonitoreo = canAccess(permissions, session.Rol, "Monitoreo");
  const canSeePermisos = canAccess(permissions, session.Rol, "Permisos");
  const canSeeAdministracion = canAccess(permissions, session.Rol, "Administración");
  const canSeeSistemaOtnImport = canSeeAdministracion || canSeePermisos;
  const warmupRoutes = [
    canSeeProduccion ? "/produccion/disponible-otn" : null,
    canSeeProduccion ? "/produccion/disponible-cc" : null,
    canSeeSistemaOtn ? "/produccion/sistema-otn" : null,
    canSeeSistemaOtn ? "/produccion/sistema-otn/ficha-otn" : null,
    canSeeBodega ? "/bodega/stock-actual" : null,
    canSeeBodega ? "/bodega/busqueda-en-oc" : null,
    canSeeAdministracion ? "/administracion/activos-fijos" : null,
    canSeeAdministracion ? "/administracion/perfiles-tp" : null,
    canSeeUsuarios ? "/usuarios" : null,
    canSeeLog ? "/configuracion/log" : null,
    canSeeMonitoreo ? "/configuracion/monitoreo" : null,
    canSeeSistemaOtnImport ? "/configuracion/importar-sistema-otn" : null,
    canSeePermisos ? "/configuracion/permisos" : null,
  ].filter((value): value is string => Boolean(value));
  const warmupApiUrls = [
    canSeeSistemaOtn ? "/api/produccion/sistema-otn" : null,
    canSeeBodega ? "/api/bodega/stock-actual" : null,
    canSeeAdministracion ? "/api/administracion/activos-fijos" : null,
    canSeeAdministracion ? "/api/administracion/perfiles-tp" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="min-h-screen lg:grid lg:h-screen lg:grid-cols-[280px_1fr] lg:overflow-hidden">
      <PlatformWarmup
        companyKey={company.key}
        routes={warmupRoutes}
        apiUrls={warmupApiUrls}
      />

      <aside className="scrollbar-hidden border-b border-[#f3d2b1] bg-[#2b3a44] px-6 py-8 text-white lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#ffb347]">
            NovaApp
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Menu</h1>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/8 p-4 shadow-inner shadow-black/10">
            <div>
              <CompanySwitcher currentCompanyKey={company.key} />
            </div>
          </div>
        </div>

        <SidebarNav
          canSeeProduccion={canSeeProduccion}
          canSeeSistemaOtn={canSeeSistemaOtn}
          canSeeBodega={canSeeBodega}
          canSeeUsuarios={canSeeUsuarios}
          canSeeLog={canSeeLog}
          canSeeMonitoreo={canSeeMonitoreo}
          canSeeSistemaOtnImport={canSeeSistemaOtnImport}
          canSeePermisos={canSeePermisos}
          canSeeAdministracion={canSeeAdministracion}
        />

        <SessionCard name={session.Nombre} role={session.Rol} />
      </aside>

      <main className="min-w-0 p-6 sm:p-8 lg:h-screen lg:overflow-y-auto lg:p-10">{children}</main>
    </div>
  );
}
