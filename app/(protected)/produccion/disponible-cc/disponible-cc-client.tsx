"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { formatDateDdMmYyyy } from "@/lib/date-format";

type MaterialRow = {
  Documento: number;
  Fecha: string;
  Codigo: string;
  Descripcion: string;
  Cantidad: number;
  PrecioUnitario: number;
  TotalLinea: number;
};

type ServiceRow = {
  Documento: number;
  Fecha: string;
  Proveedor: string;
  Descripcion: string;
  TotalLinea: number;
};

type TabKey =
  | "materiales-utilizados"
  | "materiales-devueltos"
  | "servicios-sin-oc"
  | "servicios-utilizados"
  | "nc-servicios";

type SortDirection = "asc" | "desc";

type SortState = {
  key: keyof MaterialRow;
  direction: SortDirection;
} | null;

type ServiceSortState = {
  key: keyof ServiceRow;
  direction: SortDirection;
} | null;

type FilterState = Record<keyof MaterialRow, string>;
type ServiceFilterState = Record<keyof ServiceRow, string>;

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "materiales-utilizados", label: "Materiales Utilizados" },
  { key: "materiales-devueltos", label: "Materiales Devueltos" },
  { key: "servicios-sin-oc", label: "Servicios Utilizados sin OC" },
  { key: "servicios-utilizados", label: "Servicios Utilizados" },
  { key: "nc-servicios", label: "NC Servicios" },
];

const COLUMNS: Array<{
  key: keyof MaterialRow;
  label: string;
  align?: "right";
  render?: (value: MaterialRow[keyof MaterialRow]) => ReactNode;
}> = [
  { key: "Documento", label: "Documento" },
  {
    key: "Fecha",
    label: "Fecha",
    render: (value) => formatDateDdMmYyyy(String(value)),
  },
  { key: "Codigo", label: "Codigo" },
  { key: "Descripcion", label: "Descripcion" },
  {
    key: "Cantidad",
    label: "Cantidad",
    align: "right",
    render: (value) =>
      new Intl.NumberFormat("es-CL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value)),
  },
  {
    key: "PrecioUnitario",
    label: "Precio unitario",
    align: "right",
    render: (value) => formatAmount(Number(value)),
  },
  {
    key: "TotalLinea",
    label: "Total",
    align: "right",
    render: (value) => formatAmount(Number(value)),
  },
];

const SERVICE_COLUMNS: Array<{
  key: keyof ServiceRow;
  label: string;
  align?: "right";
  render?: (value: ServiceRow[keyof ServiceRow]) => ReactNode;
}> = [
  {
    key: "Documento",
    label: "Documento",
  },
  {
    key: "Fecha",
    label: "Fecha",
    render: (value) => formatDateDdMmYyyy(String(value ?? "")),
  },
  {
    key: "Proveedor",
    label: "Proveedor",
  },
  {
    key: "Descripcion",
    label: "Descripcion",
  },
  {
    key: "TotalLinea",
    label: "Total linea",
    align: "right",
    render: (value) => formatAmount(Number(value ?? 0)),
  },
];

function formatAmount(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `$${new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function Placeholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-2">{description}</p>
    </div>
  );
}

function sortRows(rows: MaterialRow[], sort: SortState) {
  if (!sort) {
    return rows;
  }

  return [...rows].sort((left, right) => {
    const a = left[sort.key];
    const b = right[sort.key];
    const comparison =
      sort.key === "Fecha"
        ? new Date(String(a)).getTime() - new Date(String(b)).getTime()
        : typeof a === "number" && typeof b === "number"
          ? a - b
          : String(a).localeCompare(String(b), "es", {
              sensitivity: "base",
              numeric: true,
            });

  return sort.direction === "asc" ? comparison : -comparison;
  });
}

function sortServiceRows(rows: ServiceRow[], sort: ServiceSortState) {
  if (!sort) {
    return rows;
  }

  return [...rows].sort((left, right) => {
    const a = left[sort.key];
    const b = right[sort.key];
    const comparison =
      sort.key === "Fecha"
        ? new Date(String(a)).getTime() - new Date(String(b)).getTime()
        : typeof a === "number" && typeof b === "number"
          ? a - b
          : String(a).localeCompare(String(b), "es", {
              sensitivity: "base",
              numeric: true,
            });

    return sort.direction === "asc" ? comparison : -comparison;
  });
}

export function DisponibleCcClient() {
  const [cc, setCc] = useState("");
  const [ccDescripcion, setCcDescripcion] = useState<string | null>(null);
  const [ccPptoMat, setCcPptoMat] = useState<number | null>(null);
  const [ccPptoServExt, setCcPptoServExt] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("materiales-utilizados");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materialesUtilizadosTotal, setMaterialesUtilizadosTotal] = useState<number | null>(null);
  const [materialesUtilizadosRows, setMaterialesUtilizadosRows] = useState<MaterialRow[]>([]);
  const [materialesDevueltosTotal, setMaterialesDevueltosTotal] = useState<number | null>(null);
  const [materialesDevueltosRows, setMaterialesDevueltosRows] = useState<MaterialRow[]>([]);
  const [serviciosSinOcTotal, setServiciosSinOcTotal] = useState<number | null>(null);
  const [serviciosSinOcRows, setServiciosSinOcRows] = useState<MaterialRow[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    Documento: "",
    Fecha: "",
    Codigo: "",
    Descripcion: "",
    Cantidad: "",
    PrecioUnitario: "",
    TotalLinea: "",
  });
  const [sort, setSort] = useState<SortState>(null);
  const [devFilters, setDevFilters] = useState<FilterState>({
    Documento: "",
    Fecha: "",
    Codigo: "",
    Descripcion: "",
    Cantidad: "",
    PrecioUnitario: "",
    TotalLinea: "",
  });
  const [devSort, setDevSort] = useState<SortState>(null);
  const [servFilters, setServFilters] = useState<FilterState>({
    Documento: "",
    Fecha: "",
    Codigo: "",
    Descripcion: "",
    Cantidad: "",
    PrecioUnitario: "",
    TotalLinea: "",
  });
  const [servSort, setServSort] = useState<SortState>(null);
  const [serviciosUtilizadosTotal, setServiciosUtilizadosTotal] = useState<number | null>(null);
  const [serviciosUtilizadosRows, setServiciosUtilizadosRows] = useState<ServiceRow[]>([]);
  const [serviceFilters, setServiceFilters] = useState<ServiceFilterState>({
    Documento: "",
    Fecha: "",
    Proveedor: "",
    Descripcion: "",
    TotalLinea: "",
  });
  const [serviceSort, setServiceSort] = useState<ServiceSortState>(null);
  const [ncServiciosTotal, setNcServiciosTotal] = useState<number | null>(null);
  const [ncServiciosRows, setNcServiciosRows] = useState<ServiceRow[]>([]);
  const [ncFilters, setNcFilters] = useState<ServiceFilterState>({
    Documento: "",
    Fecha: "",
    Proveedor: "",
    Descripcion: "",
    TotalLinea: "",
  });
  const [ncSort, setNcSort] = useState<ServiceSortState>(null);

  const normalizedCc = useMemo(() => cc.replace(/\D/g, "").slice(0, 4), [cc]);

  const visibleRows = useMemo(() => {
    const filtered = materialesUtilizadosRows.filter((row) =>
      COLUMNS.every((column) => {
        const filter = filters[column.key].trim().toLowerCase();

        if (!filter) {
          return true;
        }

        return String(row[column.key]).toLowerCase().includes(filter);
      }),
    );

    return sortRows(filtered, sort);
  }, [filters, materialesUtilizadosRows, sort]);

  const visibleDevRows = useMemo(() => {
    const filtered = materialesDevueltosRows.filter((row) =>
      COLUMNS.every((column) => {
        const filter = devFilters[column.key].trim().toLowerCase();

        if (!filter) {
          return true;
        }

        return String(row[column.key]).toLowerCase().includes(filter);
      }),
    );

    return sortRows(filtered, devSort);
  }, [devFilters, devSort, materialesDevueltosRows]);

  const visibleServRows = useMemo(() => {
    const filtered = serviciosSinOcRows.filter((row) =>
      COLUMNS.every((column) => {
        const filter = servFilters[column.key].trim().toLowerCase();

        if (!filter) {
          return true;
        }

        return String(row[column.key]).toLowerCase().includes(filter);
      }),
    );

    return sortRows(filtered, servSort);
  }, [servFilters, servSort, serviciosSinOcRows]);

  const visibleServiceRows = useMemo(() => {
    const filtered = serviciosUtilizadosRows.filter((row) =>
      SERVICE_COLUMNS.every((column) => {
        const filter = serviceFilters[column.key].trim().toLowerCase();

        if (!filter) {
          return true;
        }

        return String(row[column.key]).toLowerCase().includes(filter);
      }),
    );

    return sortServiceRows(filtered, serviceSort);
  }, [serviceFilters, serviceSort, serviciosUtilizadosRows]);

  const visibleNcRows = useMemo(() => {
    const filtered = ncServiciosRows.filter((row) =>
      SERVICE_COLUMNS.every((column) => {
        const filter = ncFilters[column.key].trim().toLowerCase();

        if (!filter) {
          return true;
        }

        return String(row[column.key]).toLowerCase().includes(filter);
      }),
    );

    return sortServiceRows(filtered, ncSort);
  }, [ncFilters, ncServiciosRows, ncSort]);

  const disponibleMateriales = useMemo(() => {
    if (
      ccPptoMat === null ||
      materialesUtilizadosTotal === null ||
      materialesDevueltosTotal === null
    ) {
      return null;
    }

    return ccPptoMat - materialesUtilizadosTotal + materialesDevueltosTotal;
  }, [ccPptoMat, materialesDevueltosTotal, materialesUtilizadosTotal]);

  const disponibleServicios = useMemo(() => {
    if (
      ccPptoServExt === null ||
      serviciosSinOcTotal === null ||
      serviciosUtilizadosTotal === null ||
      ncServiciosTotal === null
    ) {
      return null;
    }

    return ccPptoServExt - serviciosSinOcTotal - serviciosUtilizadosTotal + ncServiciosTotal;
  }, [ccPptoServExt, ncServiciosTotal, serviciosSinOcTotal, serviciosUtilizadosTotal]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMaterialesUtilizadosTotal(null);
    setMaterialesUtilizadosRows([]);
    setMaterialesDevueltosTotal(null);
    setMaterialesDevueltosRows([]);
    setServiciosSinOcTotal(null);
    setServiciosSinOcRows([]);
    setServiciosUtilizadosTotal(null);
    setServiciosUtilizadosRows([]);
    setNcServiciosTotal(null);
    setNcServiciosRows([]);
    setCcDescripcion(null);
    setCcPptoMat(null);
    setCcPptoServExt(null);

    if (!/^\d{4}$/.test(normalizedCc)) {
      setError("El Centro de Costos debe contener 4 digitos.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/produccion/disponible-cc?cc=${encodeURIComponent(normalizedCc)}`,
        { cache: "no-store" },
      );

      const payload = (await response.json()) as
        | {
            materialesUtilizados: {
              total: number;
              rows: MaterialRow[];
            };
            materialesDevueltos: {
              total: number;
              rows: MaterialRow[];
            };
            centroCosto: {
              codigo: string;
              descripcion: string;
              presupuestoMensualMateriales: number;
              presupuestoMensualServicios: number;
            };
            serviciosSinOc: {
              total: number;
              rows: MaterialRow[];
            };
            serviciosUtilizados: {
              total: number;
              rows: ServiceRow[];
            };
            ncServicios: {
              total: number;
              rows: ServiceRow[];
            };
          }
        | { error: string };

      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error : "No fue posible consultar el centro de costos.");
        return;
      }

      setMaterialesUtilizadosTotal(payload.materialesUtilizados.total);
      setMaterialesUtilizadosRows(payload.materialesUtilizados.rows);
      setMaterialesDevueltosTotal(payload.materialesDevueltos.total);
      setMaterialesDevueltosRows(payload.materialesDevueltos.rows);
      setCcDescripcion(payload.centroCosto.descripcion.trim() || null);
      setCcPptoMat(payload.centroCosto.presupuestoMensualMateriales ?? 0);
      setCcPptoServExt(payload.centroCosto.presupuestoMensualServicios ?? 0);
      setServiciosSinOcTotal(payload.serviciosSinOc.total);
      setServiciosSinOcRows(payload.serviciosSinOc.rows);
      setServiciosUtilizadosTotal(payload.serviciosUtilizados.total);
      setServiciosUtilizadosRows(payload.serviciosUtilizados.rows);
      setNcServiciosTotal(payload.ncServicios.total);
      setNcServiciosRows(payload.ncServicios.rows);
      setActiveTab("materiales-utilizados");
      setSort(null);
      setDevSort(null);
      setServSort(null);
      setServiceSort(null);
      setNcSort(null);
      setFilters({
        Documento: "",
        Fecha: "",
        Codigo: "",
        Descripcion: "",
        Cantidad: "",
        PrecioUnitario: "",
        TotalLinea: "",
      });
      setDevFilters({
        Documento: "",
        Fecha: "",
        Codigo: "",
        Descripcion: "",
        Cantidad: "",
        PrecioUnitario: "",
        TotalLinea: "",
      });
      setServFilters({
        Documento: "",
        Fecha: "",
        Codigo: "",
        Descripcion: "",
        Cantidad: "",
        PrecioUnitario: "",
        TotalLinea: "",
      });
      setServiceFilters({
        Documento: "",
        Fecha: "",
        Proveedor: "",
        Descripcion: "",
        TotalLinea: "",
      });
      setNcFilters({
        Documento: "",
        Fecha: "",
        Proveedor: "",
        Descripcion: "",
        TotalLinea: "",
      });
    } catch {
      setError("No fue posible consultar el centro de costos.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(key: keyof MaterialRow) {
    setSort((current) => {
      if (current?.key === key) {
        return current.direction === "asc" ? { key, direction: "desc" } : null;
      }

      return { key, direction: "asc" };
    });
  }

  function toggleDevSort(key: keyof MaterialRow) {
    setDevSort((current) => {
      if (current?.key === key) {
        return current.direction === "asc" ? { key, direction: "desc" } : null;
      }

      return { key, direction: "asc" };
    });
  }

  function toggleServSort(key: keyof MaterialRow) {
    setServSort((current) => {
      if (current?.key === key) {
        return current.direction === "asc" ? { key, direction: "desc" } : null;
      }

      return { key, direction: "asc" };
    });
  }

  function toggleServiceSort(key: keyof ServiceRow) {
    setServiceSort((current) => {
      if (current?.key === key) {
        return current.direction === "asc" ? { key, direction: "desc" } : null;
      }

      return { key, direction: "asc" };
    });
  }

  function toggleNcSort(key: keyof ServiceRow) {
    setNcSort((current) => {
      if (current?.key === key) {
        return current.direction === "asc" ? { key, direction: "desc" } : null;
      }

      return { key, direction: "asc" };
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[360px_1fr] lg:items-center">
          <form onSubmit={onSubmit} className="grid gap-4 self-center">
            <div>
              <label className="block text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
                Centro de Costos
              </label>
              <input
                value={cc}
                onChange={(event) => setCc(event.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                maxLength={4}
                pattern="\d{4}"
                placeholder="0000"
                className="mt-4 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-cyan-700 focus:ring-4 focus:ring-cyan-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Consultando..." : "Consultar"}
            </button>
          </form>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                Descripción del Centro de Costos
              </p>
              <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
                {ccDescripcion ?? "Consulta un Centro de Costos para ver su descripción."}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Esta información se carga desde SAP para el centro de costos consultado.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                Presupuesto mensual materiales
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {formatAmount(ccPptoMat ?? 0)}
              </p>
            </div>

            <div
              className={[
                "rounded-3xl border p-5",
                disponibleMateriales === null
                  ? "border-slate-200 bg-slate-50"
                  : "border-cyan-200 bg-cyan-50 shadow-sm",
              ].join(" ")}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                Disponible materiales
              </p>
              <p
                className={[
                  "mt-3 text-3xl font-semibold tracking-tight",
                  disponibleMateriales === null ? "text-slate-950" : "text-cyan-950",
                ].join(" ")}
              >
                {formatAmount(disponibleMateriales)}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                Presupuesto mensual servicios
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {formatAmount(ccPptoServExt ?? 0)}
              </p>
            </div>

            <div
              className={[
                "rounded-3xl border p-5",
                disponibleServicios === null
                  ? "border-slate-200 bg-slate-50"
                  : "border-cyan-200 bg-cyan-50 shadow-sm",
              ].join(" ")}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                Disponible servicios
              </p>
              <p
                className={[
                  "mt-3 text-3xl font-semibold tracking-tight",
                  disponibleServicios === null ? "text-slate-950" : "text-cyan-950",
                ].join(" ")}
              >
                {formatAmount(disponibleServicios)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div
          role="tablist"
          aria-label="Secciones de disponible CC"
          className="flex flex-wrap gap-2"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-semibold transition",
                  isActive
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          {activeTab === "materiales-utilizados" ? (
            materialesUtilizadosTotal === null ? (
              <Placeholder
                title="Materiales Utilizados"
                description="Consulta un Centro de Costos para mostrar el total del mes actual y su detalle."
              />
            ) : (
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Total materiales utilizados
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(materialesUtilizadosTotal)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Corresponde al mes y año actual.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFilters({
                        Documento: "",
                        Fecha: "",
                        Codigo: "",
                        Descripcion: "",
                        Cantidad: "",
                        PrecioUnitario: "",
                        TotalLinea: "",
                      })}
                      className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      Limpiar filtros y orden
                    </button>
                    <p className="text-xs text-slate-500">
                      Filtra cada columna y usa el encabezado para ordenar asc/desc.
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-50 text-slate-700">
                        <tr>
                          {COLUMNS.map((column) => {
                            const isSorted = sort?.key === column.key;
                            return (
                              <th
                                key={column.key}
                                className={[
                                  "px-4 py-3 font-semibold",
                                  column.align === "right" ? "text-right" : "text-left",
                                ].join(" ")}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleSort(column.key)}
                                  className="inline-flex items-center gap-1 text-left font-semibold transition hover:text-slate-950"
                                >
                                  <span>{column.label}</span>
                                  <span className="text-xs text-slate-500">
                                    {isSorted ? (sort?.direction === "asc" ? "↑" : "↓") : "↕"}
                                  </span>
                                </button>
                              </th>
                            );
                          })}
                        </tr>
                        <tr className="border-t border-slate-200 bg-white">
                          {COLUMNS.map((column) => (
                            <th key={`${column.key}-filter`} className="px-3 py-3 align-top">
                              <input
                                value={filters[column.key]}
                                onChange={(event) =>
                                  setFilters((current) => ({
                                    ...current,
                                    [column.key]: event.target.value,
                                  }))
                                }
                                placeholder={`Filtrar ${column.label.toLowerCase()}`}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-cyan-700 focus:ring-4 focus:ring-cyan-100"
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visibleRows.length === 0 ? (
                          <tr>
                            <td className="px-4 py-6 text-slate-500" colSpan={COLUMNS.length}>
                              No se encontraron materiales para los filtros actuales.
                            </td>
                          </tr>
                        ) : (
                          visibleRows.map((row, index) => (
                            <tr key={`${row.Documento}-${index}`}>
                              {COLUMNS.map((column) => {
                                const value = row[column.key];
                                const rendered = column.render ? column.render(value) : value;

                                return (
                                  <td
                                    key={`${column.key}-${index}`}
                                    className={[
                                      "px-4 py-3",
                                      column.align === "right"
                                        ? "text-right tabular-nums text-slate-900"
                                        : "text-slate-700",
                                    ].join(" ")}
                                  >
                                    {rendered ?? "-"}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          ) : activeTab === "materiales-devueltos" ? (
            materialesDevueltosTotal === null ? (
              <Placeholder
                title="Materiales Devueltos"
                description="Consulta un Centro de Costos para mostrar el total y detalle de materiales devueltos."
              />
            ) : (
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Total materiales devueltos
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(materialesDevueltosTotal)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Corresponde a todos los movimientos asociados al Centro de Costos.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setDevFilters({
                          Documento: "",
                          Fecha: "",
                          Codigo: "",
                          Descripcion: "",
                          Cantidad: "",
                          PrecioUnitario: "",
                          TotalLinea: "",
                        })
                      }
                      className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      Limpiar filtros y orden
                    </button>
                    <p className="text-xs text-slate-500">
                      Filtra cada columna y usa el encabezado para ordenar asc/desc.
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-50 text-slate-700">
                        <tr>
                          {COLUMNS.map((column) => {
                            const isSorted = devSort?.key === column.key;
                            return (
                              <th
                                key={column.key}
                                className={[
                                  "px-4 py-3 font-semibold",
                                  column.align === "right" ? "text-right" : "text-left",
                                ].join(" ")}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleDevSort(column.key)}
                                  className="inline-flex items-center gap-1 text-left font-semibold transition hover:text-slate-950"
                                >
                                  <span>{column.label}</span>
                                  <span className="text-xs text-slate-500">
                                    {isSorted ? (devSort?.direction === "asc" ? "↑" : "↓") : "↕"}
                                  </span>
                                </button>
                              </th>
                            );
                          })}
                        </tr>
                        <tr className="border-t border-slate-200 bg-white">
                          {COLUMNS.map((column) => (
                            <th key={`${column.key}-dev-filter`} className="px-3 py-3 align-top">
                              <input
                                value={devFilters[column.key]}
                                onChange={(event) =>
                                  setDevFilters((current) => ({
                                    ...current,
                                    [column.key]: event.target.value,
                                  }))
                                }
                                placeholder={`Filtrar ${column.label.toLowerCase()}`}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-cyan-700 focus:ring-4 focus:ring-cyan-100"
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visibleDevRows.length === 0 ? (
                          <tr>
                            <td className="px-4 py-6 text-slate-500" colSpan={COLUMNS.length}>
                              No se encontraron materiales devueltos para los filtros actuales.
                            </td>
                          </tr>
                        ) : (
                          visibleDevRows.map((row, index) => (
                            <tr key={`${row.Documento}-${index}`}>
                              {COLUMNS.map((column) => {
                                const value = row[column.key];
                                const rendered = column.render ? column.render(value) : value;

                                return (
                                  <td
                                    key={`${column.key}-${index}`}
                                    className={[
                                      "px-4 py-3",
                                      column.align === "right"
                                        ? "text-right tabular-nums text-slate-900"
                                        : "text-slate-700",
                                    ].join(" ")}
                                  >
                                    {rendered ?? "-"}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          ) : activeTab === "servicios-sin-oc" ? (
            serviciosSinOcTotal === null ? (
              <Placeholder
                title="Servicios Utilizados sin OC"
                description="Consulta un Centro de Costos para mostrar el total y detalle de servicios sin OC."
              />
            ) : (
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Total servicios utilizados sin OC
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(serviciosSinOcTotal)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Corresponde a movimientos del mes y año actual.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setServFilters({
                          Documento: "",
                          Fecha: "",
                          Codigo: "",
                          Descripcion: "",
                          Cantidad: "",
                          PrecioUnitario: "",
                          TotalLinea: "",
                        })
                      }
                      className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      Limpiar filtros y orden
                    </button>
                    <p className="text-xs text-slate-500">
                      Filtra cada columna y usa el encabezado para ordenar asc/desc.
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-50 text-slate-700">
                        <tr>
                          {COLUMNS.map((column) => {
                            const isSorted = servSort?.key === column.key;
                            return (
                              <th
                                key={column.key}
                                className={[
                                  "px-4 py-3 font-semibold",
                                  column.align === "right" ? "text-right" : "text-left",
                                ].join(" ")}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleServSort(column.key)}
                                  className="inline-flex items-center gap-1 text-left font-semibold transition hover:text-slate-950"
                                >
                                  <span>{column.label}</span>
                                  <span className="text-xs text-slate-500">
                                    {isSorted ? (servSort?.direction === "asc" ? "↑" : "↓") : "↕"}
                                  </span>
                                </button>
                              </th>
                            );
                          })}
                        </tr>
                        <tr className="border-t border-slate-200 bg-white">
                          {COLUMNS.map((column) => (
                            <th key={`${column.key}-serv-filter`} className="px-3 py-3 align-top">
                              <input
                                value={servFilters[column.key]}
                                onChange={(event) =>
                                  setServFilters((current) => ({
                                    ...current,
                                    [column.key]: event.target.value,
                                  }))
                                }
                                placeholder={`Filtrar ${column.label.toLowerCase()}`}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-cyan-700 focus:ring-4 focus:ring-cyan-100"
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visibleServRows.length === 0 ? (
                          <tr>
                            <td className="px-4 py-6 text-slate-500" colSpan={COLUMNS.length}>
                              No se encontraron servicios utilizados sin OC para los filtros actuales.
                            </td>
                          </tr>
                        ) : (
                          visibleServRows.map((row, index) => (
                            <tr key={`${row.Documento}-${index}`}>
                              {COLUMNS.map((column) => {
                                const value = row[column.key];
                                const rendered = column.render ? column.render(value) : value;

                                return (
                                  <td
                                    key={`${column.key}-${index}`}
                                    className={[
                                      "px-4 py-3",
                                      column.align === "right"
                                        ? "text-right tabular-nums text-slate-900"
                                        : "text-slate-700",
                                    ].join(" ")}
                                  >
                                    {rendered ?? "-"}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          ) : activeTab === "servicios-utilizados" ? (
            serviciosUtilizadosTotal === null ? (
              <Placeholder
                title="Servicios Utilizados"
                description="Consulta un Centro de Costos para mostrar el total y detalle de servicios utilizados del mes actual."
              />
            ) : (
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Total servicios utilizados
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(serviciosUtilizadosTotal)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Corresponde a movimientos del mes y año actual.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setServiceFilters({
                          Documento: "",
                          Fecha: "",
                          Proveedor: "",
                          Descripcion: "",
                          TotalLinea: "",
                        })
                      }
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:bg-slate-50"
                    >
                      Limpiar filtros
                    </button>
                    <button
                      type="button"
                      onClick={() => setServiceSort(null)}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:bg-slate-50"
                    >
                      Quitar orden
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-50 text-slate-700">
                        <tr>
                          {SERVICE_COLUMNS.map((column) => {
                            const isSorted = serviceSort?.key === column.key;
                            return (
                              <th
                                key={column.key}
                                className={[
                                  "px-4 py-4 font-semibold",
                                  column.align === "right" ? "text-right" : "text-left",
                                ].join(" ")}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleServiceSort(column.key)}
                                  className="inline-flex items-center gap-1 text-left font-semibold transition hover:text-slate-950"
                                >
                                  <span>{column.label}</span>
                                  <span className="text-xs text-slate-500">
                                    {isSorted ? (serviceSort?.direction === "asc" ? "↑" : "↓") : "↕"}
                                  </span>
                                </button>
                              </th>
                            );
                          })}
                        </tr>
                        <tr className="border-t border-slate-200 bg-white">
                          {SERVICE_COLUMNS.map((column) => (
                            <th key={`${column.key}-service-filter`} className="px-3 py-3 align-top">
                              <input
                                value={serviceFilters[column.key]}
                                onChange={(event) =>
                                  setServiceFilters((current) => ({
                                    ...current,
                                    [column.key]: event.target.value,
                                  }))
                                }
                                placeholder={`Filtrar ${column.label.toLowerCase()}`}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-cyan-700 focus:ring-4 focus:ring-cyan-100"
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visibleServiceRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={SERVICE_COLUMNS.length}
                              className="px-4 py-10 text-center text-sm text-slate-500"
                            >
                              No hay servicios utilizados para este centro de costos.
                            </td>
                          </tr>
                        ) : (
                          visibleServiceRows.map((row) => (
                            <tr key={`${row.Documento}-${row.Fecha}-${row.Proveedor}-${row.Descripcion}`} className="bg-white">
                              {SERVICE_COLUMNS.map((column) => {
                                const value = row[column.key];
                                const rendered = column.render ? column.render(value) : value;

                                return (
                                  <td
                                    key={column.key}
                                    className={[
                                      "px-4 py-3 align-top text-slate-700",
                                      column.align === "right" ? "text-right font-medium tabular-nums" : "",
                                    ].join(" ")}
                                  >
                                    {rendered}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          ) : activeTab === "nc-servicios" ? (
            ncServiciosTotal === null ? (
              <Placeholder
                title="NC Servicios"
                description="Consulta un Centro de Costos para mostrar el total y detalle de NC servicios del mes actual."
              />
            ) : (
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Total NC servicios
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(ncServiciosTotal)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Corresponde a movimientos del mes y año actual.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setNcFilters({
                          Documento: "",
                          Fecha: "",
                          Proveedor: "",
                          Descripcion: "",
                          TotalLinea: "",
                        })
                      }
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:bg-slate-50"
                    >
                      Limpiar filtros
                    </button>
                    <button
                      type="button"
                      onClick={() => setNcSort(null)}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:bg-slate-50"
                    >
                      Quitar orden
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-50 text-slate-700">
                        <tr>
                          {SERVICE_COLUMNS.map((column) => {
                            const isSorted = ncSort?.key === column.key;
                            return (
                              <th
                                key={column.key}
                                className={[
                                  "px-4 py-4 font-semibold",
                                  column.align === "right" ? "text-right" : "text-left",
                                ].join(" ")}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleNcSort(column.key)}
                                  className="inline-flex items-center gap-1 text-left font-semibold transition hover:text-slate-950"
                                >
                                  <span>{column.label}</span>
                                  <span className="text-xs text-slate-500">
                                    {isSorted ? (ncSort?.direction === "asc" ? "↑" : "↓") : "↕"}
                                  </span>
                                </button>
                              </th>
                            );
                          })}
                        </tr>
                        <tr className="border-t border-slate-200 bg-white">
                          {SERVICE_COLUMNS.map((column) => (
                            <th key={`${column.key}-nc-filter`} className="px-3 py-3 align-top">
                              <input
                                value={ncFilters[column.key]}
                                onChange={(event) =>
                                  setNcFilters((current) => ({
                                    ...current,
                                    [column.key]: event.target.value,
                                  }))
                                }
                                placeholder={`Filtrar ${column.label.toLowerCase()}`}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-cyan-700 focus:ring-4 focus:ring-cyan-100"
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visibleNcRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={SERVICE_COLUMNS.length}
                              className="px-4 py-10 text-center text-sm text-slate-500"
                            >
                              No hay NC servicios para este centro de costos.
                            </td>
                          </tr>
                        ) : (
                          visibleNcRows.map((row) => (
                            <tr
                              key={`${row.Documento}-${row.Fecha}-${row.Proveedor}-${row.Descripcion}`}
                              className="bg-white"
                            >
                              {SERVICE_COLUMNS.map((column) => {
                                const value = row[column.key];
                                const rendered = column.render ? column.render(value) : value;

                                return (
                                  <td
                                    key={column.key}
                                    className={[
                                      "px-4 py-3 align-top text-slate-700",
                                      column.align === "right"
                                        ? "text-right font-medium tabular-nums"
                                        : "",
                                    ].join(" ")}
                                  >
                                    {rendered}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          ) : (
            <Placeholder
              title={TABS.find((tab) => tab.key === activeTab)?.label ?? "Sección"}
              description="Pestaña lista para conectar su consulta SAP."
            />
          )}
        </div>
      </div>
    </div>
  );
}
