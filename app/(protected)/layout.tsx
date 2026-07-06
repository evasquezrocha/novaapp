import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { getActiveSapCompany } from "@/lib/sap-stock";
import { CompanySwitcher } from "@/components/company-switcher";
import { SessionCard } from "@/components/session-card";
import { PlatformWarmup } from "@/components/platform-warmup";
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

  const [session, permissions, company] = await Promise.all([
    getSessionUserByToken(token),
    listPermissions(),
    getActiveSapCompany(),
  ]);

  if (!session) {
    redirect("/login");
  }
  const canSeeProduccion = canAccess(permissions, session.Rol, "Producción");
  const canSeeSistemaOtn = canAccess(permissions, session.Rol, "Sistema OTN");
  const canSeeBodega = canAccess(permissions, session.Rol, "Bodega");
  const canSeeUsuarios = canAccess(permissions, session.Rol, "Usuarios");
  const canSeeLog = canAccess(permissions, session.Rol, "Log");
  const canSeeMonitoreo = canAccess(permissions, session.Rol, "Monitoreo");
  const canSeePermisos = canAccess(permissions, session.Rol, "Permisos");
  const canSeeAdministracion = canAccess(permissions, session.Rol, "Administración");
  const canSeeAsistencia = canAccess(permissions, session.Rol, "Asistencia");
  const isSupervisor = session.Rol === "Supervisor";
  const canSeeSistemaOtnImport =
    !isSupervisor && (canSeeAdministracion || canSeePermisos);
  const canSeeDisponibleOtn = canAccess(permissions, session.Rol, "Disponible OTN");
  const canSeeDisponibleCc = canAccess(permissions, session.Rol, "Disponible CC");
  const canSeeFichaOtn = canAccess(permissions, session.Rol, "Ficha OTN");
  const canSeeStockActual = canAccess(permissions, session.Rol, "Stock Actual");
  const canSeeBusquedaEnOc = canAccess(permissions, session.Rol, "Búsqueda en OC");
  const canSeeActivosFijos = canAccess(permissions, session.Rol, "Activos Fijos");
  const canSeePerfilesTp = canAccess(permissions, session.Rol, "Perfiles TP");
  const canSeeRoles = canAccess(permissions, session.Rol, "Roles");
  const canSeeCtSupervisores = canAccess(permissions, session.Rol, "CT Supervisores");
  const canSeeConfigSection =
    !isSupervisor &&
    (canSeeUsuarios ||
    canSeeLog ||
    canSeeMonitoreo ||
    canSeeSistemaOtnImport ||
    canSeePermisos ||
    canSeeRoles);
  const canSeeProduccionSection = canSeeProduccion || canSeeDisponibleOtn || canSeeDisponibleCc;
  const canSeeSistemaOtnSection = canSeeSistemaOtn || canSeeFichaOtn;
  const canSeeBodegaSection = canSeeBodega || canSeeStockActual || canSeeBusquedaEnOc;
  const canSeeAdministracionSection = canSeeAdministracion || canSeeActivosFijos || canSeePerfilesTp;
  const canSeeAsistenciaSection = canSeeAsistencia || canSeeCtSupervisores;
  const uniqueStrings = (values: Array<string | null>) =>
    Array.from(new Set(values.filter((value): value is string => Boolean(value))));
  const warmupRoutes = uniqueStrings([
    canSeeProduccion ? "/produccion" : null,
    canSeeDisponibleOtn ? "/produccion/disponible-otn" : null,
    canSeeDisponibleCc ? "/produccion/disponible-cc" : null,
    canSeeSistemaOtn ? "/produccion/sistema-otn" : null,
    canSeeFichaOtn ? "/produccion/sistema-otn/ficha-otn" : null,
    canSeeBodega ? "/bodega/stock-actual" : null,
    canSeeStockActual ? "/bodega/stock-actual" : null,
    canSeeBusquedaEnOc ? "/bodega/busqueda-en-oc" : null,
    canSeeAdministracion ? "/administracion/activos-fijos" : null,
    canSeeActivosFijos ? "/administracion/activos-fijos" : null,
    canSeePerfilesTp ? "/administracion/perfiles-tp" : null,
    canSeeUsuarios ? "/usuarios" : null,
    canSeeLog ? "/configuracion/log" : null,
    canSeeMonitoreo ? "/configuracion/monitoreo" : null,
    canSeeSistemaOtnImport ? "/configuracion/importar-sistema-otn" : null,
    canSeePermisos ? "/configuracion/permisos" : null,
    canSeeRoles ? "/configuracion/permisos/roles" : null,
    canSeeAsistencia ? "/asistencia/ct-supervisores" : null,
    canSeeCtSupervisores ? "/asistencia/ct-supervisores" : null,
  ]);
  const warmupApiUrls = uniqueStrings([
    canSeeDisponibleOtn ? "/api/produccion/disponible-otn" : null,
    canSeeDisponibleCc ? "/api/produccion/disponible-cc" : null,
    canSeeSistemaOtn ? "/api/produccion/sistema-otn" : null,
    canSeeFichaOtn ? "/api/produccion/sistema-otn/ficha" : null,
    canSeeStockActual ? "/api/bodega/stock-actual" : null,
    canSeeBusquedaEnOc ? "/api/bodega/busqueda-en-oc" : null,
    canSeeUsuarios ? "/api/usuarios" : null,
    canSeeActivosFijos ? "/api/administracion/activos-fijos" : null,
    canSeePerfilesTp ? "/api/administracion/perfiles-tp" : null,
    canSeePermisos ? "/api/configuracion/permisos" : null,
    canSeeRoles ? "/api/configuracion/roles" : null,
    canSeeCtSupervisores ? "/api/asistencia/ct-supervisores" : null,
  ]);

  return (
    <div className="min-h-screen lg:grid lg:h-screen lg:grid-cols-[280px_1fr] lg:overflow-hidden">

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
          canSeeAsistencia={canSeeAsistencia}
          canSeeAdministracion={canSeeAdministracion}
          navVisibility={{
            produccion: {
              section: canSeeProduccionSection,
              disponibleOtn: canSeeDisponibleOtn,
              disponibleCc: canSeeDisponibleCc,
            },
            sistemaOtn: {
              section: canSeeSistemaOtnSection,
              sistemaOtn: canSeeSistemaOtn,
              fichaOtn: canSeeFichaOtn,
            },
            bodega: {
              section: canSeeBodegaSection,
              stockActual: canSeeStockActual,
              busquedaEnOc: canSeeBusquedaEnOc,
            },
            administracion: {
              section: canSeeAdministracionSection,
              activosFijos: canSeeActivosFijos,
              perfilesTp: canSeePerfilesTp,
            },
            configuracion: {
              section: canSeeConfigSection,
              usuarios: canSeeUsuarios,
              log: canSeeLog,
              monitoreo: canSeeMonitoreo,
              importarSistemaOtn: canSeeSistemaOtnImport,
              permisos: canSeePermisos,
              roles: canSeeRoles,
            },
            asistencia: {
              section: canSeeAsistenciaSection,
              ctSupervisores: canSeeCtSupervisores,
            },
          }}
        />

        <SessionCard name={session.Nombre} role={session.Rol} />
      </aside>

      <main className="min-w-0 p-6 sm:p-8 lg:h-screen lg:overflow-y-auto lg:p-10">
        <PlatformWarmup companyKey={company.key} routes={warmupRoutes} apiUrls={warmupApiUrls} />
        {children}
      </main>
    </div>
  );
}
