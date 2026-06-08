import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { getActiveSapCompany } from "@/lib/sap-stock";
import { CompanySwitcher } from "@/components/company-switcher";
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
  const canSeeBodega = canAccess(permissions, session.Rol, "Bodega");
  const canSeeUsuarios = canAccess(permissions, session.Rol, "Usuarios");
  const canSeeLog = canAccess(permissions, session.Rol, "Log");
  const canSeePermisos = canAccess(permissions, session.Rol, "Permisos");
  const canSeeAdministracion = canAccess(permissions, session.Rol, "Administración");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-[#f3d2b1] bg-[#2b3a44] px-6 py-8 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#ffb347]">
            NovaApp
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Menú</h1>
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#f3d2b1]">
              Empresa activa
            </p>
            <p className="text-sm font-semibold text-white/90">{company.label}</p>
          </div>
          <div className="mt-4">
            <CompanySwitcher currentCompanyKey={company.key} />
          </div>
        </div>

        <SidebarNav
          canSeeProduccion={canSeeProduccion}
          canSeeBodega={canSeeBodega}
          canSeeUsuarios={canSeeUsuarios}
          canSeeLog={canSeeLog}
          canSeePermisos={canSeePermisos}
          canSeeAdministracion={canSeeAdministracion}
        />

        <SessionCard name={session.Nombre} role={session.Rol} />
      </aside>

      <main className="min-w-0 p-6 sm:p-8 lg:p-10">{children}</main>
    </div>
  );
}
