"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function navLinkClass(active: boolean) {
  return [
    "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition",
    active
      ? "bg-[#ff9200] text-white hover:bg-[#ffb347]"
      : "bg-white/10 text-white hover:bg-[#ffb347]/15",
  ].join(" ");
}

function sectionLinkClass(active: boolean) {
  return [
    "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition",
    active
      ? "bg-[#ff9200] text-white hover:bg-[#ffb347]"
      : "bg-white/10 text-white hover:bg-[#ffb347]/15",
  ].join(" ");
}

export function SidebarNav({
  canSeeProduccion,
  canSeeBodega,
  canSeeUsuarios,
  canSeeLog,
  canSeePermisos,
}: {
  canSeeProduccion: boolean;
  canSeeBodega: boolean;
  canSeeUsuarios: boolean;
  canSeeLog: boolean;
  canSeePermisos: boolean;
}) {
  const pathname = usePathname();
  const isUsuariosActive = pathname.startsWith("/usuarios");
  const isLogActive = pathname.startsWith("/configuracion/log");
  const isPermisosActive = pathname.startsWith("/configuracion/permisos");

  const showConfiguracion = canSeeUsuarios || canSeeLog || canSeePermisos;

  return (
    <nav aria-label="Menú principal" className="space-y-2">
      {canSeeProduccion ? (
        <div className="rounded-2xl border border-[#f3d2b1]/20 bg-white/4 p-3">
          <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.32em] text-[#f3d2b1]">
            Producción
          </p>
          <Link
            href="/produccion/disponible-otn"
            className={navLinkClass(pathname === "/produccion/disponible-otn")}
          >
            <span>Disponible OTN</span>
            <span aria-hidden className="text-white/90">
              →
            </span>
          </Link>
          <Link
            href="/produccion/disponible-cc"
            className={`mt-2 ${navLinkClass(pathname === "/produccion/disponible-cc")}`}
          >
            <span>Disponible CC</span>
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
            className={sectionLinkClass(pathname === "/bodega/stock-actual")}
          >
            <span>Stock Actual</span>
            <span aria-hidden className="text-white/90">
              →
            </span>
          </Link>

          <Link
            href="/bodega/busqueda-en-oc"
            className={`mt-2 ${sectionLinkClass(pathname === "/bodega/busqueda-en-oc")}`}
          >
            <span>Búsqueda en OC</span>
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
              className={navLinkClass(isUsuariosActive)}
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
              className={`mt-2 ${navLinkClass(isLogActive)}`}
            >
              <span>Log</span>
              <span aria-hidden className="text-white/90">
                →
              </span>
            </Link>
          ) : null}

          {canSeePermisos ? (
            <Link
              href="/configuracion/permisos"
              className={`mt-2 ${navLinkClass(isPermisosActive)}`}
            >
              <span>Permisos</span>
              <span aria-hidden className="text-white/90">
                →
              </span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
