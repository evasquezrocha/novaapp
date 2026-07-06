"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SectionKey =
  | "produccion"
  | "sistemaOtn"
  | "bodega"
  | "administracion"
  | "configuracion"
  | "asistencia";

type NavLinkItem = {
  kind: "link";
  href: string;
  label: string;
  active: boolean;
  visible: boolean;
};

type NavGroupItem = {
  kind: "group";
  key: string;
  label: string;
  active: boolean;
  visible: boolean;
  children: NavLinkItem[];
};

type Section = {
  key: SectionKey;
  title: string;
  visible: boolean;
  items: Array<NavLinkItem | NavGroupItem>;
};

type NavVisibility = {
  produccion: {
    section: boolean;
    disponibleOtn: boolean;
    disponibleCc: boolean;
  };
  sistemaOtn: {
    section: boolean;
    sistemaOtn: boolean;
    fichaOtn: boolean;
  };
  bodega: {
    section: boolean;
    stockActual: boolean;
    busquedaEnOc: boolean;
  };
  administracion: {
    section: boolean;
    activosFijos: boolean;
    perfilesTp: boolean;
  };
  configuracion: {
    section: boolean;
    usuarios: boolean;
    log: boolean;
    monitoreo: boolean;
    importarSistemaOtn: boolean;
    permisos: boolean;
    roles: boolean;
  };
  asistencia: {
    section: boolean;
    ctSupervisores: boolean;
  };
};

function navLinkClass(active: boolean, visible: boolean) {
  return [
    "flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition",
    !visible
      ? "cursor-not-allowed bg-white/6 text-white/35"
      : active
        ? "bg-[#ff9200] text-white hover:bg-[#ffb347]"
        : "bg-white/10 text-white hover:bg-[#ffb347]/15",
  ].join(" ");
}

function sectionButtonClass(active: boolean) {
  return [
    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.22em] transition",
    active ? "bg-white/12 text-[#ffb347]" : "text-[#f3d2b1] hover:bg-white/8 hover:text-white",
  ].join(" ");
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      className={`text-base leading-none transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      v
    </span>
  );
}

export function SidebarNav({
  canSeeProduccion,
  canSeeSistemaOtn,
  canSeeBodega,
  canSeeUsuarios,
  canSeeLog,
  canSeeMonitoreo,
  canSeeSistemaOtnImport,
  canSeePermisos,
  canSeeAsistencia,
  canSeeAdministracion,
  navVisibility,
}: {
  canSeeProduccion: boolean;
  canSeeSistemaOtn: boolean;
  canSeeBodega: boolean;
  canSeeUsuarios: boolean;
  canSeeLog: boolean;
  canSeeMonitoreo: boolean;
  canSeeSistemaOtnImport: boolean;
  canSeePermisos: boolean;
  canSeeAsistencia: boolean;
  canSeeAdministracion: boolean;
  navVisibility: NavVisibility;
}) {
  const pathname = usePathname();
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);

  const isUsuariosActive = pathname.startsWith("/usuarios");
  const isLogActive = pathname.startsWith("/configuracion/log");
  const isMonitoreoActive = pathname.startsWith("/configuracion/monitoreo");
  const isImportSistemaOtnActive = pathname.startsWith("/configuracion/importar-sistema-otn");
  const isPermisosActive = pathname.startsWith("/configuracion/permisos");
  const isActivosFijosActive = pathname.startsWith("/administracion/activos-fijos");
  const isPerfilesTpActive = pathname.startsWith("/administracion/perfiles-tp");
  const isCtSupervisoresActive = pathname.startsWith("/asistencia/ct-supervisores");
  const isDisponibleOtnActive = pathname === "/produccion/disponible-otn";
  const isDisponibleCcActive = pathname === "/produccion/disponible-cc";
  const isSistemaOtnActive = pathname === "/produccion/sistema-otn";
  const isFichaOtnActive = pathname === "/produccion/sistema-otn/ficha-otn";
  const isStockActualActive = pathname === "/bodega/stock-actual";
  const isBusquedaOcActive = pathname === "/bodega/busqueda-en-oc";
  const activeSection: SectionKey | null = isUsuariosActive
    ? "configuracion"
    : isLogActive || isMonitoreoActive || isImportSistemaOtnActive || isPermisosActive
      ? "configuracion"
      : isActivosFijosActive || isPerfilesTpActive
        ? "administracion"
        : isCtSupervisoresActive
          ? "asistencia"
          : isStockActualActive || isBusquedaOcActive
            ? "bodega"
            : isSistemaOtnActive || isFichaOtnActive
              ? "sistemaOtn"
              : isDisponibleOtnActive || isDisponibleCcActive
                ? "produccion"
                : null;

  const sections: Section[] = [
    {
      key: "produccion",
      title: "Produccion",
      visible: navVisibility.produccion.section && (canSeeProduccion || navVisibility.produccion.disponibleOtn || navVisibility.produccion.disponibleCc),
      items: [
        {
          kind: "group",
          key: "produccion-group",
          label: "Submódulos",
          active: isDisponibleOtnActive || isDisponibleCcActive,
          visible: true,
          children: [
            {
              kind: "link",
              href: "/produccion/disponible-otn",
              label: "Disponible OTN",
              active: isDisponibleOtnActive,
              visible: navVisibility.produccion.disponibleOtn,
            },
            {
              kind: "link",
              href: "/produccion/disponible-cc",
              label: "Disponible CC",
              active: isDisponibleCcActive,
              visible: navVisibility.produccion.disponibleCc,
            },
          ],
        },
      ],
    },
    {
      key: "sistemaOtn",
      title: "Sistema OTN",
      visible: navVisibility.sistemaOtn.section && (canSeeSistemaOtn || navVisibility.sistemaOtn.fichaOtn),
      items: [
        {
          kind: "group",
          key: "sistema-otn-group",
          label: "Submódulos",
          active: isSistemaOtnActive || isFichaOtnActive,
          visible: true,
          children: [
            {
              kind: "link",
              href: "/produccion/sistema-otn",
              label: "Sistema OTN",
              active: isSistemaOtnActive,
              visible: navVisibility.sistemaOtn.sistemaOtn,
            },
            {
              kind: "link",
              href: "/produccion/sistema-otn/ficha-otn",
              label: "Ficha OTN",
              active: isFichaOtnActive,
              visible: navVisibility.sistemaOtn.fichaOtn,
            },
          ],
        },
      ],
    },
    {
      key: "bodega",
      title: "Bodega",
      visible: navVisibility.bodega.section && (canSeeBodega || navVisibility.bodega.stockActual || navVisibility.bodega.busquedaEnOc),
      items: [
        {
          kind: "group",
          key: "bodega-group",
          label: "Submódulos",
          active: isStockActualActive || isBusquedaOcActive,
          visible: true,
          children: [
            {
              kind: "link",
              href: "/bodega/stock-actual",
              label: "Stock Actual",
              active: isStockActualActive,
              visible: navVisibility.bodega.stockActual,
            },
            {
              kind: "link",
              href: "/bodega/busqueda-en-oc",
              label: "Búsqueda en OC",
              active: isBusquedaOcActive,
              visible: navVisibility.bodega.busquedaEnOc,
            },
          ],
        },
      ],
    },
    {
      key: "asistencia",
      title: "ASISTENCIA",
      visible: navVisibility.asistencia.section && (canSeeAsistencia || navVisibility.asistencia.ctSupervisores),
      items: [
        {
          kind: "group",
          key: "asistencia-group",
          label: "Submódulos",
          active: isCtSupervisoresActive,
          visible: true,
          children: [
            {
              kind: "link",
              href: "/asistencia/ct-supervisores",
              label: "CT Supervisores",
              active: isCtSupervisoresActive,
              visible: navVisibility.asistencia.ctSupervisores,
            },
          ],
        },
      ],
    },
    {
      key: "administracion",
      title: "Administracion",
      visible:
        navVisibility.administracion.section &&
        (canSeeAdministracion ||
          navVisibility.administracion.activosFijos ||
          navVisibility.administracion.perfilesTp),
      items: [
        {
          kind: "group",
          key: "administracion-group",
          label: "Submódulos",
          active: isActivosFijosActive || isPerfilesTpActive,
          visible: true,
          children: [
            {
              kind: "link",
              href: "/administracion/activos-fijos",
              label: "Activos Fijos",
              active: isActivosFijosActive,
              visible: navVisibility.administracion.activosFijos,
            },
            {
              kind: "link",
              href: "/administracion/perfiles-tp",
              label: "Perfiles TP",
              active: isPerfilesTpActive,
              visible: navVisibility.administracion.perfilesTp,
            },
          ],
        },
      ],
    },
    {
      key: "configuracion",
      title: "Configuracion",
      visible:
        navVisibility.configuracion.section &&
        (canSeeUsuarios ||
          canSeeLog ||
          canSeeMonitoreo ||
          canSeeSistemaOtnImport ||
          canSeePermisos ||
          navVisibility.configuracion.roles),
      items: [
        {
          kind: "link",
          href: "/usuarios",
          label: "Usuarios",
          active: isUsuariosActive,
          visible: navVisibility.configuracion.usuarios,
        },
        {
          kind: "link",
          href: "/configuracion/log",
          label: "Log",
          active: isLogActive,
          visible: navVisibility.configuracion.log,
        },
        {
          kind: "link",
          href: "/configuracion/monitoreo",
          label: "Monitoreo",
          active: isMonitoreoActive,
          visible: navVisibility.configuracion.monitoreo,
        },
        {
          kind: "link",
          href: "/configuracion/importar-sistema-otn",
          label: "Importar Sistema OTN",
          active: isImportSistemaOtnActive,
          visible: navVisibility.configuracion.importarSistemaOtn,
        },
        {
          kind: "group",
          key: "permisos",
          label: "Permisos",
          active: isPermisosActive,
          visible: navVisibility.configuracion.permisos || navVisibility.configuracion.roles,
          children: [
            {
              kind: "link",
              href: "/configuracion/permisos",
              label: "Matriz",
              active: pathname === "/configuracion/permisos",
              visible: navVisibility.configuracion.permisos,
            },
            {
              kind: "link",
              href: "/configuracion/permisos/roles",
              label: "Roles",
              active: pathname.startsWith("/configuracion/permisos/roles"),
              visible: navVisibility.configuracion.roles,
            },
          ],
        },
      ],
    },
  ];

  return (
    <nav aria-label="Menu principal" className="space-y-2">
      {sections
        .filter((section) => section.visible)
        .map((section) => {
          const selectedSection = openSection ?? activeSection;
          const isExpanded = selectedSection === section.key;

          return (
            <div key={section.key} className="rounded-2xl border border-[#f3d2b1]/20 bg-white/4 p-3">
              <button
                type="button"
                className={sectionButtonClass(isExpanded)}
                aria-expanded={isExpanded}
                onClick={() => {
                  setOpenSection((current) => (current === section.key ? null : section.key));
                }}
              >
                <span>{section.title}</span>
                <Chevron open={isExpanded} />
              </button>

              {isExpanded ? (
                <div className="mt-3 space-y-2">
                  {section.items.map((item) => {
                    const visible = item.kind === "group" ? item.visible : item.visible;
                    if (!visible) {
                      return null;
                    }

                    if (item.kind === "group") {
                      return (
                        <div key={item.key} className="space-y-2 border-l border-white/10 pl-3">
                          {item.children
                            .filter((child) => child.visible)
                            .map((child) => (
                              <Link
                                key={child.href}
                                href={child.href}
                                className={navLinkClass(child.active, child.visible)}
                              >
                                <span>{child.label}</span>
                                <span aria-hidden className="text-white/90">
                                  {"->"}
                                </span>
                              </Link>
                            ))}
                        </div>
                      );
                    }

                    return (
                      <Link key={item.href} href={item.href} className={navLinkClass(item.active, item.visible)}>
                        <span>{item.label}</span>
                        <span aria-hidden className="text-white/90">
                          {"->"}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
    </nav>
  );
}
