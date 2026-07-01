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

type Section = {
  key: SectionKey;
  title: string;
  visible: boolean;
  items: Array<{
    href: string;
    label: string;
    active: boolean;
  }>;
};

function navLinkClass(active: boolean) {
  return [
    "flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition",
    active
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
  canSeeAdministracion,
}: {
  canSeeProduccion: boolean;
  canSeeSistemaOtn: boolean;
  canSeeBodega: boolean;
  canSeeUsuarios: boolean;
  canSeeLog: boolean;
  canSeeMonitoreo: boolean;
  canSeeSistemaOtnImport: boolean;
  canSeePermisos: boolean;
  canSeeAdministracion: boolean;
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

  const activeSection: SectionKey | null = isUsuariosActive
    ? "configuracion"
    : isLogActive || isMonitoreoActive || isImportSistemaOtnActive || isPermisosActive
      ? "configuracion"
      : isActivosFijosActive
        ? "administracion"
        : isPerfilesTpActive
          ? "administracion"
        : isCtSupervisoresActive
          ? "asistencia"
        : pathname.startsWith("/bodega/")
          ? "bodega"
          : pathname.startsWith("/produccion/sistema-otn")
            ? "sistemaOtn"
            : pathname.startsWith("/produccion/")
              ? "produccion"
              : null;

  const sections: Section[] = [
    {
      key: "produccion",
      title: "Produccion",
      visible: canSeeProduccion,
      items: [
        {
          href: "/produccion/disponible-otn",
          label: "Disponible OTN",
          active: pathname === "/produccion/disponible-otn",
        },
        {
          href: "/produccion/disponible-cc",
          label: "Disponible CC",
          active: pathname === "/produccion/disponible-cc",
        },
      ],
    },
    {
      key: "sistemaOtn",
      title: "Sistema OTN",
      visible: canSeeSistemaOtn,
      items: [
        {
          href: "/produccion/sistema-otn",
          label: "Sistema OTN",
          active: pathname === "/produccion/sistema-otn",
        },
        {
          href: "/produccion/sistema-otn/ficha-otn",
          label: "Ficha OTN",
          active: pathname === "/produccion/sistema-otn/ficha-otn",
        },
      ],
    },
    {
      key: "bodega",
      title: "Bodega",
      visible: canSeeBodega,
      items: [
        {
          href: "/bodega/stock-actual",
          label: "Stock Actual",
          active: pathname === "/bodega/stock-actual",
        },
        {
          href: "/bodega/busqueda-en-oc",
          label: "Busqueda en OC",
          active: pathname === "/bodega/busqueda-en-oc",
        },
      ],
    },
    {
      key: "administracion",
      title: "Administracion",
      visible: canSeeAdministracion,
      items: [
        {
          href: "/administracion/activos-fijos",
          label: "Activos Fijos",
          active: isActivosFijosActive,
        },
        {
          href: "/administracion/perfiles-tp",
          label: "Perfiles TP",
          active: isPerfilesTpActive,
        },
      ],
    },
    {
      key: "configuracion",
      title: "Configuracion",
      visible:
        canSeeUsuarios || canSeeLog || canSeeMonitoreo || canSeeSistemaOtnImport || canSeePermisos,
      items: [
        ...(canSeeUsuarios
          ? [
              {
                href: "/usuarios",
                label: "Usuarios",
                active: isUsuariosActive,
              },
            ]
          : []),
        ...(canSeeLog
          ? [
              {
                href: "/configuracion/log",
                label: "Log",
                active: isLogActive,
              },
            ]
          : []),
        ...(canSeeMonitoreo
          ? [
              {
                href: "/configuracion/monitoreo",
                label: "Monitoreo",
                active: isMonitoreoActive,
              },
            ]
          : []),
        ...(canSeeSistemaOtnImport
          ? [
              {
                href: "/configuracion/importar-sistema-otn",
                label: "Importar Sistema OTN",
                active: isImportSistemaOtnActive,
              },
            ]
          : []),
        ...(canSeePermisos
          ? [
              {
                href: "/configuracion/permisos",
                label: "Permisos",
                active: isPermisosActive,
              },
            ]
          : []),
      ],
    },
    {
      key: "asistencia",
      title: "ASISTENCIA",
      visible: true,
      items: [
        {
          href: "/asistencia/ct-supervisores",
          label: "CT Supervisores",
          active: isCtSupervisoresActive,
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
                  {section.items.map((item) => (
                    <Link key={item.href} href={item.href} className={navLinkClass(item.active)}>
                      <span>{item.label}</span>
                      <span aria-hidden className="text-white/90">
                        {"->"}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
    </nav>
  );
}
