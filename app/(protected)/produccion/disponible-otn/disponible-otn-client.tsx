"use client";

import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDateDdMmYyyy } from "@/lib/date-format";
import {
  isSapCompanyKey,
  resolveSapCompanyKeyFromEmpresa,
  type SapCompanyKey,
} from "@/lib/company-config";
import { setActiveSapCompany } from "@/lib/company-session";

type ProjectRow = {
  MATPPTO: number | null;
  SERVPPTO: number | null;
  DESCRIPCION: string;
};

type MaterialUsedRow = {
  Documento: number;
  Fecha: string;
  Codigo: string;
  Descripcion: string;
  Cantidad: number;
  PrecioUnitario: number;
  TotalLinea: number;
};

type ServicesRow = {
  Documento: number;
  Fecha: string;
  Proveedor: string;
  Descripcion: string;
  TotalLinea: number;
};

type MaterialesUtilizados = {
  total: number;
  rows: MaterialUsedRow[];
};

type MaterialesDevueltos = {
  total: number;
  rows: MaterialUsedRow[];
};

type ServiciosSinOc = {
  total: number;
  rows: ServicesRow[];
};

type ServiciosUtilizados = {
  total: number;
  rows: ServicesRow[];
};

type NcServicios = {
  total: number;
  rows: ServicesRow[];
};

type AsientosDirectosRow = {
  Numero: number;
  Fecha: string;
  BaseRef: string;
  Cuenta: string;
  NombreCuenta: string;
  Debe: number;
  Haber: number;
  Proyecto: string;
  ProfitCode: string;
  Memo: string;
  Linea: number;
  Saldo: number;
  TipoTransaccion: number;
};

type AsientosDirectos = {
  total: number;
  rows: AsientosDirectosRow[];
};

type FondosRendidosRow = {
  NumeroPago: number;
  FechaPago: string;
  EnFavorDe: string;
  Cuenta: string;
  Descripcion: string;
  Monto: number;
};

type FondosRendidos = {
  total: number;
  rows: FondosRendidosRow[];
};

type TabKey =
  | "materiales-utilizados"
  | "materiales-devueltos"
  | "servicios-sin-oc"
  | "servicios-utilizados"
  | "nc-servicios"
  | "asientos-directos"
  | "fondos-rendidos";

type SortDirection = "asc" | "desc";

type SortState = {
  key: string;
  direction: SortDirection;
} | null;

type TableState = {
  filters: Record<string, string>;
  sort: SortState;
};

type CellValue = string | number | null;

type ColumnDef<T> = {
  key: string;
  label: string;
  align?: "left" | "right";
  sortType?: "text" | "number" | "date";
  getValue: (row: T) => CellValue;
  render?: (value: CellValue, row: T) => ReactNode;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "materiales-utilizados", label: "Materiales Utilizados" },
  { key: "materiales-devueltos", label: "Materiales Devueltos" },
  { key: "servicios-sin-oc", label: "Servicios Utilizados sin OC" },
  { key: "servicios-utilizados", label: "Servicios Utilizados" },
  { key: "nc-servicios", label: "NC Servicios" },
  { key: "asientos-directos", label: "Asientos Directos" },
  { key: "fondos-rendidos", label: "Fondos Rendidos" },
];

const MATERIAL_COLUMNS: ColumnDef<MaterialUsedRow>[] = [
  { key: "Documento", label: "Documento", sortType: "number", getValue: (row) => row.Documento },
  { key: "Fecha", label: "Fecha", sortType: "date", getValue: (row) => row.Fecha, render: (value) => formatDate(String(value ?? "")) },
  { key: "Codigo", label: "Codigo", sortType: "text", getValue: (row) => row.Codigo },
  { key: "Descripcion", label: "Descripcion", sortType: "text", getValue: (row) => row.Descripcion },
  {
    key: "Cantidad",
    label: "Cantidad",
    align: "right",
    sortType: "number",
    getValue: (row) => row.Cantidad,
    render: (value) =>
      new Intl.NumberFormat("es-CL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value ?? 0)),
  },
  {
    key: "PrecioUnitario",
    label: "Precio unitario",
    align: "right",
    sortType: "number",
    getValue: (row) => row.PrecioUnitario,
    render: (value) => formatAmount(Number(value ?? 0)),
  },
  {
    key: "TotalLinea",
    label: "Total",
    align: "right",
    sortType: "number",
    getValue: (row) => row.TotalLinea,
    render: (value) => formatAmount(Number(value ?? 0)),
  },
];

const SERVICE_COLUMNS: ColumnDef<ServicesRow>[] = [
  { key: "Documento", label: "Documento", sortType: "number", getValue: (row) => row.Documento },
  { key: "Fecha", label: "Fecha", sortType: "date", getValue: (row) => row.Fecha, render: (value) => formatDate(String(value ?? "")) },
  { key: "Proveedor", label: "Proveedor", sortType: "text", getValue: (row) => row.Proveedor },
  { key: "Descripcion", label: "Descripcion", sortType: "text", getValue: (row) => row.Descripcion },
  {
    key: "TotalLinea",
    label: "Total",
    align: "right",
    sortType: "number",
    getValue: (row) => row.TotalLinea,
    render: (value) => formatAmount(Number(value ?? 0)),
  },
];

const ASIENTO_COLUMNS: ColumnDef<AsientosDirectosRow>[] = [
  { key: "Numero", label: "Numero", sortType: "number", getValue: (row) => row.Numero },
  { key: "Fecha", label: "Fecha", sortType: "date", getValue: (row) => row.Fecha, render: (value) => formatDate(String(value ?? "")) },
  { key: "Cuenta", label: "Cuenta", sortType: "text", getValue: (row) => row.Cuenta },
  { key: "NombreCuenta", label: "Nombre cuenta", sortType: "text", getValue: (row) => row.NombreCuenta },
  { key: "ProfitCode", label: "Centro de Costos", sortType: "text", getValue: (row) => row.ProfitCode },
  {
    key: "Debe",
    label: "Debe",
    align: "right",
    sortType: "number",
    getValue: (row) => row.Debe,
    render: (value) => formatAmount(Number(value ?? 0)),
  },
  {
    key: "Haber",
    label: "Haber",
    align: "right",
    sortType: "number",
    getValue: (row) => row.Haber,
    render: (value) => formatAmount(Number(value ?? 0)),
  },
  {
    key: "Saldo",
    label: "Saldo",
    align: "right",
    sortType: "number",
    getValue: (row) => row.Saldo,
    render: (value) => {
      const amount = Number(value ?? 0);
      const formatted = formatAmount(Math.abs(amount));

      if (amount < 0) {
        return `-${formatted}`;
      }

      if (amount > 0) {
        return formatted;
      }

      return formatted;
    },
  },
  { key: "Memo", label: "Observaciones", sortType: "text", getValue: (row) => row.Memo },
];

const FONDOS_COLUMNS: ColumnDef<FondosRendidosRow>[] = [
  {
    key: "NumeroPago",
    label: "N° Pago",
    sortType: "number",
    getValue: (row) => row.NumeroPago,
  },
  {
    key: "FechaPago",
    label: "Fecha Pago",
    sortType: "date",
    getValue: (row) => row.FechaPago,
    render: (value) => formatDate(String(value ?? "")),
  },
  {
    key: "EnFavorDe",
    label: "En Favor De",
    sortType: "text",
    getValue: (row) => row.EnFavorDe,
  },
  {
    key: "Cuenta",
    label: "Cuenta",
    sortType: "text",
    getValue: (row) => row.Cuenta,
  },
  {
    key: "Descripcion",
    label: "Descripción",
    sortType: "text",
    getValue: (row) => row.Descripcion,
  },
  {
    key: "Monto",
    label: "Monto",
    align: "right",
    sortType: "number",
    getValue: (row) => row.Monto,
    render: (value) => formatAmount(Number(value ?? 0)),
  },
];

function getInitialTableState(): Record<TabKey, TableState> {
  return {
    "materiales-utilizados": { filters: {}, sort: null },
    "materiales-devueltos": { filters: {}, sort: null },
    "servicios-sin-oc": { filters: {}, sort: null },
    "servicios-utilizados": { filters: {}, sort: null },
    "nc-servicios": { filters: {}, sort: null },
    "asientos-directos": { filters: {}, sort: null },
    "fondos-rendidos": { filters: {}, sort: null },
  };
}

function formatAmount(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `$${new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatDate(value: string) {
  return formatDateDdMmYyyy(value);
}

function calculateDisponibleMateriales(
  presupuestoMateriales: number | null,
  materialesUtilizados: number | null,
  materialesDevueltos: number | null,
) {
  if (presupuestoMateriales === null) {
    return null;
  }

  return presupuestoMateriales - (materialesUtilizados ?? 0) + (materialesDevueltos ?? 0);
}

function calculateDisponibleServicios(
  presupuestoServicios: number | null,
  serviciosSinOc: number | null,
  serviciosUtilizados: number | null,
  ncServicios: number | null,
) {
  if (presupuestoServicios === null) {
    return null;
  }

  return (
    presupuestoServicios -
    (serviciosSinOc ?? 0) -
    (serviciosUtilizados ?? 0) +
    (ncServicios ?? 0)
  );
}

function calculateCostoTotal(
  materialesUtilizados: number | null,
  materialesDevueltos: number | null,
  serviciosSinOc: number | null,
  serviciosUtilizados: number | null,
  ncServicios: number | null,
  asientosDirectos: number | null,
  fondosRendidos: number | null,
) {
  return (
    (materialesUtilizados ?? 0) -
    (materialesDevueltos ?? 0) +
    (serviciosSinOc ?? 0) +
    (serviciosUtilizados ?? 0) -
    (ncServicios ?? 0) +
    (asientosDirectos ?? 0) +
    (fondosRendidos ?? 0)
  );
}

function compareCellValues(
  left: CellValue,
  right: CellValue,
  sortType: ColumnDef<unknown>["sortType"],
) {
  if (sortType === "date") {
    const leftTime = new Date(String(left ?? "")).getTime();
    const rightTime = new Date(String(right ?? "")).getTime();
    return leftTime - rightTime;
  }

  if (sortType === "number") {
    return Number(left ?? 0) - Number(right ?? 0);
  }

  return String(left ?? "").localeCompare(String(right ?? ""), "es", {
    sensitivity: "base",
  });
}

function renderSortableTable<T extends Record<string, CellValue>>({
  columns,
  tabKey,
  rows,
  emptyMessage,
  tableState,
  setTableState,
}: {
  columns: Array<ColumnDef<T>>;
  tabKey: TabKey;
  rows: T[];
  emptyMessage: string;
  tableState: TableState;
  setTableState: Dispatch<SetStateAction<Record<TabKey, TableState>>>;
}) {
  const filteredRows = rows.filter((row) =>
    columns.every((column) => {
      const filter = tableState.filters[column.key]?.trim().toLowerCase();

      if (!filter) {
        return true;
      }

      return String(column.getValue(row) ?? "")
        .toLowerCase()
        .includes(filter);
    }),
  );

  const sortedRows = [...filteredRows].sort((left, right) => {
    if (!tableState.sort) {
      return 0;
    }

    const column = columns.find((item) => item.key === tableState.sort?.key);
    if (!column) {
      return 0;
    }

    const comparison = compareCellValues(
      column.getValue(left),
      column.getValue(right),
      column.sortType,
    );

    return tableState.sort.direction === "asc" ? comparison : -comparison;
  });

  function updateFilter(columnKey: string, value: string) {
    setTableState((current) => ({
      ...current,
      [tabKey]: {
        ...current[tabKey],
        filters: {
          ...current[tabKey].filters,
          [columnKey]: value,
        },
      },
    }));
  }

  function toggleSort(columnKey: string) {
    setTableState((current) => {
      const currentSort = current[tabKey].sort;
      const nextSort: SortState =
        currentSort?.key === columnKey
          ? currentSort.direction === "asc"
            ? { key: columnKey, direction: "desc" }
            : null
          : { key: columnKey, direction: "asc" };

      return {
        ...current,
        [tabKey]: {
          ...current[tabKey],
          sort: nextSort,
        },
      };
    });
  }

  function clearFilters() {
    setTableState((current) => ({
      ...current,
      [tabKey]: {
        filters: {},
        sort: null,
      },
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={clearFilters}
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
              {columns.map((column) => {
                const isSorted = tableState.sort?.key === column.key;
                const sortLabel = isSorted
                  ? tableState.sort?.direction === "asc"
                    ? " ↑"
                    : " ↓"
                  : "";

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
                      <span className="text-xs text-slate-500">{sortLabel}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
            <tr className="border-t border-slate-200 bg-white">
              {columns.map((column) => (
                <th key={`${column.key}-filter`} className="px-3 py-3 align-top">
                  <input
                    value={tableState.filters[column.key] ?? ""}
                    onChange={(event) => updateFilter(column.key, event.target.value)}
                    placeholder={`Filtrar ${column.label.toLowerCase()}`}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-cyan-700 focus:ring-4 focus:ring-cyan-100"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedRows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedRows.map((row, index) => (
                <tr key={`${String(row.Documento ?? index)}-${index}`}>
                  {columns.map((column) => {
                    const value = column.getValue(row);
                    const rendered = column.render ? column.render(value, row) : value;

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
  );
}

export function DisponibleOtnClient({
  currentCompanyKey,
}: {
  currentCompanyKey: SapCompanyKey;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialOtn = searchParams.get("otn")?.trim() ?? "";
  const companyParam = searchParams.get("company")?.trim();
  const empresaParam = searchParams.get("empresa")?.trim();
  const companyKey = companyParam
    ? isSapCompanyKey(companyParam)
      ? companyParam
      : resolveSapCompanyKeyFromEmpresa(companyParam)
    : empresaParam
      ? resolveSapCompanyKeyFromEmpresa(empresaParam)
      : null;
  const [otn, setOtn] = useState(initialOtn);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<ProjectRow | null>(null);
  const [materiales, setMateriales] = useState<MaterialesUtilizados | null>(null);
  const [materialesDevueltos, setMaterialesDevueltos] =
    useState<MaterialesDevueltos | null>(null);
  const [serviciosSinOc, setServiciosSinOc] = useState<ServiciosSinOc | null>(null);
  const [serviciosUtilizados, setServiciosUtilizados] =
    useState<ServiciosUtilizados | null>(null);
  const [ncServicios, setNcServicios] = useState<NcServicios | null>(null);
  const [asientosDirectos, setAsientosDirectos] =
    useState<AsientosDirectos | null>(null);
  const [fondosRendidos, setFondosRendidos] =
    useState<FondosRendidos | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("materiales-utilizados");
  const [tableState, setTableState] = useState<Record<TabKey, TableState>>(
    getInitialTableState,
  );
  const autoLoadedOtnRef = useRef<string | null>(null);
  const syncedCompanyRef = useRef<SapCompanyKey | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRow(null);
    setMateriales(null);
    setMaterialesDevueltos(null);
    setServiciosSinOc(null);
    setServiciosUtilizados(null);
    setNcServicios(null);
    setAsientosDirectos(null);
    setFondosRendidos(null);

    if (!/^\d{4,6}$/.test(otn)) {
      setError("El OTN debe contener entre 4 y 6 digitos.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/produccion/disponible-otn?otn=${encodeURIComponent(otn)}${
          companyKey ? `&company=${encodeURIComponent(companyKey)}` : ""
        }`,
      );
      const data = (await response.json()) as
        | {
            row: ProjectRow;
            materiales: MaterialesUtilizados;
            materialesDevueltos: MaterialesDevueltos;
            serviciosSinOc: ServiciosSinOc;
            serviciosUtilizados: ServiciosUtilizados;
            ncServicios: NcServicios;
            asientosDirectos: AsientosDirectos;
            fondosRendidos: FondosRendidos;
          }
        | { error: string };

      if (!response.ok || "error" in data) {
        setError("error" in data ? data.error : "No fue posible consultar el OTN.");
        return;
      }

      setRow(data.row);
      setMateriales(data.materiales);
      setMaterialesDevueltos(data.materialesDevueltos);
      setServiciosSinOc(data.serviciosSinOc);
      setServiciosUtilizados(data.serviciosUtilizados);
      setNcServicios(data.ncServicios);
      setAsientosDirectos(data.asientosDirectos);
      setFondosRendidos(data.fondosRendidos);
      setActiveTab("materiales-utilizados");
    } catch {
      setError("No fue posible consultar el OTN.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialOtn || autoLoadedOtnRef.current === initialOtn) {
      return;
    }

    autoLoadedOtnRef.current = initialOtn;
    setOtn(initialOtn);
    void (async () => {
      setLoading(true);
      setError(null);
      setRow(null);
      setMateriales(null);
      setMaterialesDevueltos(null);
      setServiciosSinOc(null);
      setServiciosUtilizados(null);
      setNcServicios(null);
      setAsientosDirectos(null);
      setFondosRendidos(null);

      try {
        const response = await fetch(
          `/api/produccion/disponible-otn?otn=${encodeURIComponent(initialOtn)}${
            companyKey ? `&company=${encodeURIComponent(companyKey)}` : ""
          }`,
        );
        const data = (await response.json()) as
          | {
              row: ProjectRow;
              materiales: MaterialesUtilizados;
              materialesDevueltos: MaterialesDevueltos;
              serviciosSinOc: ServiciosSinOc;
              serviciosUtilizados: ServiciosUtilizados;
              ncServicios: NcServicios;
              asientosDirectos: AsientosDirectos;
              fondosRendidos: FondosRendidos;
            }
          | { error: string };

        if (!response.ok || "error" in data) {
          setError("error" in data ? data.error : "No fue posible consultar el OTN.");
          return;
        }

        setRow(data.row);
        setMateriales(data.materiales);
        setMaterialesDevueltos(data.materialesDevueltos);
        setServiciosSinOc(data.serviciosSinOc);
        setServiciosUtilizados(data.serviciosUtilizados);
        setNcServicios(data.ncServicios);
        setAsientosDirectos(data.asientosDirectos);
        setFondosRendidos(data.fondosRendidos);
        setActiveTab("materiales-utilizados");
      } catch {
        setError("No fue posible consultar el OTN.");
      } finally {
        setLoading(false);
      }
    })();
  }, [companyKey, initialOtn]);

  useEffect(() => {
    if (!companyKey || companyKey === currentCompanyKey || syncedCompanyRef.current === companyKey) {
      return;
    }

    syncedCompanyRef.current = companyKey;

    void (async () => {
      try {
        await setActiveSapCompany(companyKey);
        router.refresh();
      } catch {
        syncedCompanyRef.current = null;
      }
    })();
  }, [companyKey, currentCompanyKey, router]);

  const disponibleMateriales = calculateDisponibleMateriales(
    row?.MATPPTO ?? null,
    materiales?.total ?? null,
    materialesDevueltos?.total ?? null,
  );
  const disponibleServicios = calculateDisponibleServicios(
    row?.SERVPPTO ?? null,
    serviciosSinOc?.total ?? null,
    serviciosUtilizados?.total ?? null,
    ncServicios?.total ?? null,
  );
  const costoTotal = calculateCostoTotal(
    materiales?.total ?? null,
    materialesDevueltos?.total ?? null,
    serviciosSinOc?.total ?? null,
    serviciosUtilizados?.total ?? null,
    ncServicios?.total ?? null,
    asientosDirectos?.total ?? null,
    fondosRendidos?.total ?? null,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[360px_1fr] lg:items-center">
          <form onSubmit={onSubmit} className="grid gap-4 self-center">
            <div>
              <label className="block text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
                OTN
              </label>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={otn}
                  onChange={(event) =>
                    setOtn(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  maxLength={6}
                  pattern="\d{4,6}"
                  placeholder="0000 - 000000"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-cyan-700 focus:ring-4 focus:ring-cyan-100 sm:max-w-xs"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Consultando..." : "Consultar"}
                  </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
                {error}
              </div>
            ) : null}
          </form>

          <div className="flex min-h-[108px] items-center">
            {row ? (
              <div className="grid w-full gap-4 md:grid-cols-5 md:items-center">
                <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Descripcion del proyecto
                  </p>
                  <p className="mt-3 text-lg font-semibold text-slate-950">
                    {row.DESCRIPCION || "-"}
                  </p>
                </article>

                <article className="rounded-3xl border border-slate-950 bg-slate-950 p-5 shadow-sm md:col-span-2 xl:col-span-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ffb347]">
                    COSTO TOTAL ACTUAL
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-white">
                    {formatAmount(costoTotal)}
                  </p>
                </article>

                <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Presupuesto Materiales
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(row.MATPPTO)}
                  </p>
                </article>

                <article className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Disponible Materiales
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-cyan-950">
                    {formatAmount(disponibleMateriales)}
                  </p>
                </article>

                <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Presupuesto Servicios
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(row.SERVPPTO)}
                  </p>
                </article>

                <article className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Disponible Servicios
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-cyan-950">
                    {formatAmount(disponibleServicios)}
                  </p>
                </article>
              </div>
            ) : (
              <div className="flex w-full items-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Los resultados apareceran aqui junto al boton de consulta.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div
          role="tablist"
          aria-label="Secciones de disponible OTN"
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
            materiales ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Total materiales utilizados
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(materiales.total)}
                  </p>
                </div>
                {renderSortableTable({
                  columns: MATERIAL_COLUMNS,
                  tabKey: "materiales-utilizados",
                  rows: materiales.rows,
                  emptyMessage: "No hay materiales utilizados para este OTN.",
                  tableState: tableState["materiales-utilizados"],
                  setTableState,
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                Consulta un OTN para mostrar el total y el detalle de materiales utilizados.
              </div>
            )
          ) : activeTab === "materiales-devueltos" ? (
            materialesDevueltos ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Total materiales devueltos
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(materialesDevueltos.total)}
                  </p>
                </div>
                {renderSortableTable({
                  columns: MATERIAL_COLUMNS,
                  tabKey: "materiales-devueltos",
                  rows: materialesDevueltos.rows,
                  emptyMessage: "No hay materiales devueltos para este OTN.",
                  tableState: tableState["materiales-devueltos"],
                  setTableState,
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                Consulta un OTN para mostrar el total y el detalle de materiales devueltos.
              </div>
            )
          ) : activeTab === "servicios-sin-oc" ? (
            serviciosSinOc ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Total servicios utilizados sin OC
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(serviciosSinOc.total)}
                  </p>
                </div>
                {renderSortableTable({
                  columns: SERVICE_COLUMNS,
                  tabKey: "servicios-sin-oc",
                  rows: serviciosSinOc.rows,
                  emptyMessage: "No hay servicios utilizados sin OC para este OTN.",
                  tableState: tableState["servicios-sin-oc"],
                  setTableState,
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                Consulta un OTN para mostrar el total y el detalle de servicios utilizados sin OC.
              </div>
            )
          ) : activeTab === "servicios-utilizados" ? (
            serviciosUtilizados ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Total servicios utilizados
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(serviciosUtilizados.total)}
                  </p>
                </div>
                {renderSortableTable({
                  columns: SERVICE_COLUMNS,
                  tabKey: "servicios-utilizados",
                  rows: serviciosUtilizados.rows,
                  emptyMessage: "No hay servicios utilizados para este OTN.",
                  tableState: tableState["servicios-utilizados"],
                  setTableState,
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                Consulta un OTN para mostrar el total y el detalle de servicios utilizados.
              </div>
            )
          ) : activeTab === "nc-servicios" ? (
            ncServicios ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Total NC servicios
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(ncServicios.total)}
                  </p>
                </div>
                {renderSortableTable({
                  columns: SERVICE_COLUMNS,
                  tabKey: "nc-servicios",
                  rows: ncServicios.rows,
                  emptyMessage: "No hay NC servicios para este OTN.",
                  tableState: tableState["nc-servicios"],
                  setTableState,
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                Consulta un OTN para mostrar el total y el detalle de NC servicios.
              </div>
            )
          ) : activeTab === "asientos-directos" ? (
            asientosDirectos ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Saldo total asientos directos
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(asientosDirectos.total)}
                  </p>
                </div>
                {renderSortableTable({
                  columns: ASIENTO_COLUMNS,
                  tabKey: "asientos-directos",
                  rows: asientosDirectos.rows,
                  emptyMessage: "No hay asientos directos para este OTN.",
                  tableState: tableState["asientos-directos"],
                  setTableState,
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                Consulta un OTN para mostrar el total y el detalle de asientos directos.
              </div>
            )
          ) : activeTab === "fondos-rendidos" ? (
            fondosRendidos ? (
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Total fondos rendidos
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(fondosRendidos.total)}
                  </p>
                </div>
                {renderSortableTable({
                  columns: FONDOS_COLUMNS,
                  tabKey: "fondos-rendidos",
                  rows: fondosRendidos.rows,
                  emptyMessage: "No hay fondos rendidos para este OTN.",
                  tableState: tableState["fondos-rendidos"],
                  setTableState,
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                Consulta un OTN para mostrar el total y el detalle de fondos rendidos.
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
              La seccion queda lista para cargar su consulta especifica.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
