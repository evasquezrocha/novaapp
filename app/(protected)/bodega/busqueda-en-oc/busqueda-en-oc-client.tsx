"use client";

import { useMemo, useState } from "react";
import type { PurchaseOrderSearchMode, PurchaseOrderSearchRow } from "@/lib/sap-stock";

type TabKey = PurchaseOrderSearchMode;
type SortDirection = "asc" | "desc";
type FilterState = Record<keyof PurchaseOrderSearchRow, string>;

type ColumnDef = {
  key: keyof PurchaseOrderSearchRow;
  label: string;
  sortType?: "text" | "number" | "date";
};

const TABS: Array<{ key: TabKey; label: string; placeholder: string }> = [
  {
    key: "proveedor",
    label: "Busqueda por Proveedor",
    placeholder: "Buscar por nombre de proveedor...",
  },
  {
    key: "descripcion",
    label: "Busqueda por Descripcion",
    placeholder: "Buscar por descripcion de item...",
  },
  {
    key: "codigo",
    label: "Busqueda por Codigo",
    placeholder: "Buscar por codigo de item...",
  },
];

const COLUMNS: ColumnDef[] = [
  { key: "N° OC", label: "N° OC", sortType: "number" },
  { key: "OTN", label: "OTN", sortType: "text" },
  { key: "CC", label: "CC", sortType: "text" },
  { key: "PROVEEDOR", label: "Proveedor", sortType: "text" },
  { key: "N° O/C", label: "N° O/C", sortType: "number" },
  { key: "FECHA O/C", label: "Fecha O/C", sortType: "date" },
  { key: "N° ITEM", label: "N° Item", sortType: "text" },
  { key: "DESCRIPCIÓN", label: "Descripcion", sortType: "text" },
  { key: "CANT", label: "Cant.", sortType: "number" },
  { key: "CANT ABIERTA", label: "Cant. Abierta", sortType: "number" },
  { key: "PRECIO", label: "Precio", sortType: "number" },
  { key: "TOTAL", label: "Total", sortType: "number" },
  { key: "SOLICITADO POR", label: "Solicitado por", sortType: "text" },
  { key: "CREADO POR", label: "Creado por", sortType: "text" },
];

const INITIAL_FILTERS = COLUMNS.reduce((acc, column) => {
  acc[column.key] = "";
  return acc;
}, {} as FilterState);

function formatAmount(value: number) {
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
  }).format(date);
}

function compareValues(
  left: PurchaseOrderSearchRow,
  right: PurchaseOrderSearchRow,
  key: keyof PurchaseOrderSearchRow,
  sortType?: ColumnDef["sortType"],
) {
  const a = left[key];
  const b = right[key];

  if (sortType === "number") {
    return Number(a ?? 0) - Number(b ?? 0);
  }

  if (sortType === "date") {
    return new Date(String(a ?? "")).getTime() - new Date(String(b ?? "")).getTime();
  }

  return String(a ?? "").localeCompare(String(b ?? ""), "es", {
    sensitivity: "base",
    numeric: true,
  });
}

export function BusquedaEnOcClient() {
  const [activeTab, setActiveTab] = useState<TabKey>("proveedor");
  const [queries, setQueries] = useState<Record<TabKey, string>>({
    proveedor: "",
    descripcion: "",
    codigo: "",
  });
  const [rowsByTab, setRowsByTab] = useState<Record<TabKey, PurchaseOrderSearchRow[]>>({
    proveedor: [],
    descripcion: [],
    codigo: [],
  });
  const [loadingTab, setLoadingTab] = useState<TabKey | null>(null);
  const [errorByTab, setErrorByTab] = useState<Record<TabKey, string | null>>({
    proveedor: null,
    descripcion: null,
    codigo: null,
  });
  const [tableStateByTab, setTableStateByTab] = useState<
    Record<TabKey, { filters: FilterState; sortKey: keyof PurchaseOrderSearchRow; sortDirection: SortDirection }>
  >({
    proveedor: {
      filters: INITIAL_FILTERS,
      sortKey: "FECHA O/C",
      sortDirection: "desc",
    },
    descripcion: {
      filters: INITIAL_FILTERS,
      sortKey: "FECHA O/C",
      sortDirection: "desc",
    },
    codigo: {
      filters: INITIAL_FILTERS,
      sortKey: "FECHA O/C",
      sortDirection: "desc",
    },
  });

  async function searchTab(tab: TabKey) {
    const query = queries[tab].trim();
    if (!query) {
      setErrorByTab((current) => ({
        ...current,
        [tab]: "Escribe un texto para buscar.",
      }));
      setRowsByTab((current) => ({ ...current, [tab]: [] }));
      return;
    }

    setLoadingTab(tab);
    setErrorByTab((current) => ({ ...current, [tab]: null }));

    try {
      const response = await fetch(
        `/api/bodega/busqueda-en-oc?mode=${encodeURIComponent(tab)}&q=${encodeURIComponent(query)}`,
        { cache: "no-store" },
      );

      const payload = (await response.json()) as {
        rows?: PurchaseOrderSearchRow[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible consultar las ordenes de compra.");
      }

      if (payload.error) {
        throw new Error(payload.error);
      }

      setRowsByTab((current) => ({
        ...current,
        [tab]: payload.rows ?? [],
      }));
    } catch (fetchError) {
      setErrorByTab((current) => ({
        ...current,
        [tab]:
          fetchError instanceof Error
            ? fetchError.message
            : "No fue posible consultar las ordenes de compra.",
      }));
      setRowsByTab((current) => ({ ...current, [tab]: [] }));
    } finally {
      setLoadingTab((current) => (current === tab ? null : current));
    }
  }

  const visibleRows = useMemo(() => {
    const rows = rowsByTab[activeTab];
    const state = tableStateByTab[activeTab];

    const filtered = rows.filter((row) =>
      COLUMNS.every((column) => {
        const filter = state.filters[column.key].trim().toLowerCase();
        if (!filter) {
          return true;
        }
        return String(row[column.key]).toLowerCase().includes(filter);
      }),
    );

    const sortColumn = COLUMNS.find((column) => column.key === state.sortKey);

    return [...filtered].sort((left, right) => {
      const comparison = compareValues(left, right, state.sortKey, sortColumn?.sortType);
      return state.sortDirection === "asc" ? comparison : -comparison;
    });
  }, [activeTab, rowsByTab, tableStateByTab]);

  function handleSort(key: keyof PurchaseOrderSearchRow) {
    setTableStateByTab((current) => {
      const state = current[activeTab];
      const nextDirection =
        state.sortKey === key
          ? state.sortDirection === "asc"
            ? "desc"
            : "asc"
          : "asc";

      return {
        ...current,
        [activeTab]: {
          ...state,
          sortKey: key,
          sortDirection: nextDirection,
        },
      };
    });
  }

  const currentTab = TABS.find((tab) => tab.key === activeTab) ?? TABS[0];
  const currentState = tableStateByTab[activeTab];
  const currentRows = rowsByTab[activeTab];
  const currentError = errorByTab[activeTab];

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-cyan-600 bg-cyan-50 text-cyan-800"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={queries[activeTab]}
            onChange={(event) =>
              setQueries((current) => ({ ...current, [activeTab]: event.target.value }))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void searchTab(activeTab);
              }
            }}
            placeholder={currentTab.placeholder}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-cyan-700 focus:ring-4 focus:ring-cyan-100"
          />
          <button
            type="button"
            onClick={() => void searchTab(activeTab)}
            disabled={loadingTab === activeTab}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingTab === activeTab ? "Buscando..." : "Buscar"}
          </button>
        </div>

        {currentError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {currentError}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{currentTab.label}</p>
          <p className="text-xs text-slate-500">
            Filtra por columna o cambia el criterio con las pestañas superiores.
          </p>
        </div>
        <div className="text-sm text-slate-600">{currentRows.length} registros</div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              {COLUMNS.map((column) => {
                const isActive = currentState.sortKey === column.key;
                const ariaSort = isActive
                  ? currentState.sortDirection === "asc"
                    ? "ascending"
                    : "descending"
                  : "none";

                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className="px-4 py-3 align-bottom"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className="flex items-center gap-2 font-semibold text-slate-800"
                    >
                      <span>{column.label}</span>
                      <span className="text-xs text-slate-500">
                        {isActive ? (currentState.sortDirection === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
            <tr className="border-t border-slate-200 bg-white">
              {COLUMNS.map((column) => (
                <th key={column.key} className="px-4 py-3">
                  <input
                    value={currentState.filters[column.key]}
                    onChange={(event) =>
                      setTableStateByTab((current) => ({
                        ...current,
                        [activeTab]: {
                          ...current[activeTab],
                          filters: {
                            ...current[activeTab].filters,
                            [column.key]: event.target.value,
                          },
                        },
                      }))
                    }
                    placeholder={`Filtrar ${column.label.toLowerCase()}`}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {visibleRows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={COLUMNS.length}>
                  {currentRows.length === 0
                    ? "Busca por proveedor, descripcion o codigo para ver resultados."
                    : "No se encontraron ordenes de compra que coincidan con los filtros."}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={`${row["N° O/C"]}-${row["N° ITEM"]}`} className="align-top hover:bg-slate-50">
                  {COLUMNS.map((column) => {
                    const value = row[column.key];
                    const rendered =
                      column.sortType === "date"
                        ? formatDate(String(value ?? ""))
                        : column.sortType === "number"
                          ? formatAmount(Number(value ?? 0))
                          : String(value ?? "");

                    return (
                      <td
                        key={column.key}
                        className={`px-4 py-3 ${
                          column.sortType === "number" ? "tabular-nums text-slate-900" : "text-slate-700"
                        }`}
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
  );
}
