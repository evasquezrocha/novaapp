"use client";

import { useMemo, useState } from "react";
import type {
  EquivalentStockRow,
  StockActualRow,
  OpenPurchaseOrderRow,
} from "@/lib/sap-stock";

type ColumnKey = keyof StockActualRow;
type SortDirection = "asc" | "desc";
type FilterState = Record<ColumnKey, string>;

const COLUMNS: Array<{
  key: ColumnKey;
  label: string;
}> = [
  { key: "Codigo", label: "Codigo" },
  { key: "Descripcion", label: "Descripción" },
  { key: "Bodega", label: "Bodega" },
  { key: "Stock Actual", label: "Stock Actual" },
  { key: "Unidad", label: "Unidad" },
  { key: "Pedido", label: "Pedido" },
  { key: "Stock Minimo", label: "Stock Minimo" },
];

const INITIAL_FILTERS: FilterState = {
  Codigo: "",
  Descripcion: "",
  Bodega: "",
  "Stock Actual": "",
  Unidad: "",
  Pedido: "",
  "Stock Minimo": "",
};

function formatValue(value: number) {
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function compareValues(a: StockActualRow, b: StockActualRow, key: ColumnKey) {
  const left = a[key];
  const right = b[key];

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), "es", {
    sensitivity: "base",
    numeric: true,
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
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

function escapeCsvCell(value: string) {
  if (/[",\n;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csvContent = [
    "\ufeff",
    ...rows.map((row) => row.map(escapeCsvCell).join(";")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function DetailPanel({
  itemCode,
  description,
  rows,
  loading,
  error,
  equivalentRows,
  equivalentLoading,
  equivalentError,
  equivalentFor,
  onSearchEquivalents,
  onClose,
}: {
  itemCode: string;
  description: string;
  rows: OpenPurchaseOrderRow[];
  loading: boolean;
  error: string | null;
  equivalentRows: EquivalentStockRow[] | null;
  equivalentLoading: boolean;
  equivalentError: string | null;
  equivalentFor: string | null;
  onSearchEquivalents: () => void;
  onClose: () => void;
}) {
  return (
    <aside className="fixed inset-y-0 right-0 z-20 w-full max-w-2xl border-l border-slate-200 bg-white shadow-2xl">
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                Detalle
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Pedidos abiertos
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {itemCode} - {description}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={onSearchEquivalents}
                className="rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={equivalentLoading}
              >
                {equivalentLoading ? "Buscando..." : "Buscar equivalencias"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Cargando pedidos abiertos...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              No hay pedidos abiertos para este articulo.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div
                  key={`${row.NumeroOC}-${row.FechaEmision}-${row.NombreProveedor}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        N° OC
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {row.NumeroOC}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Fecha de emisión
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {formatDate(row.FechaEmision)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Fecha de entrega
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {formatDate(row.FechaEntrega)}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Nombre de proveedor
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {row.NombreProveedor}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Solicitante
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {row.SlpName || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Cantidad total
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {formatValue(row.CantidadTotal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Cantidad pendiente
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {formatValue(row.CantidadPendiente)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Valor unitario
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {formatCurrency(row.ValorUnitario)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Valor total
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {formatCurrency(row.ValorTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                Codigos equivalentes
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {equivalentFor
                  ? `Resultados para ${equivalentFor}`
                  : "Selecciona un codigo y busca sus equivalencias."}
              </p>
            </div>
          </div>

          {equivalentError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {equivalentError}
            </div>
          ) : equivalentLoading ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Buscando codigos equivalentes...
            </div>
          ) : equivalentFor && equivalentRows ? (
            equivalentRows.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                No se encontraron codigos equivalentes para este articulo.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Tipo</th>
                      <th className="px-3 py-2 font-semibold">Codigo</th>
                      <th className="px-3 py-2 font-semibold">Descripcion</th>
                      <th className="px-3 py-2 font-semibold">Unidad</th>
                      <th className="px-3 py-2 font-semibold">Bodega</th>
                      <th className="px-3 py-2 text-right font-semibold">
                        Stock Actual
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        Pedido
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">
                        Stock Minimo
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {equivalentRows.map((row) => (
                      <tr key={`${row.Codigo}-${row.Bodega}`}>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                              row.EsPrincipal
                                ? "bg-amber-100 text-amber-900"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {row.EsPrincipal ? "Base" : "Equivalente"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {row.Codigo}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {row.Descripcion}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{row.Unidad}</td>
                        <td className="px-3 py-2 text-slate-700">{row.Bodega}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {formatValue(row["Stock Actual"])}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {formatValue(row.Pedido)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                          {formatValue(row["Stock Minimo"])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Busca equivalencias para ver los codigos relacionados y su stock.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export function StockActualTable({ rows }: { rows: StockActualRow[] }) {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [sortKey, setSortKey] = useState<ColumnKey>("Codigo");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedRow, setSelectedRow] = useState<StockActualRow | null>(null);
  const [detailRows, setDetailRows] = useState<OpenPurchaseOrderRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [equivalentRows, setEquivalentRows] = useState<EquivalentStockRow[] | null>(null);
  const [equivalentLoading, setEquivalentLoading] = useState(false);
  const [equivalentError, setEquivalentError] = useState<string | null>(null);
  const [equivalentFor, setEquivalentFor] = useState<string | null>(null);
  const [rowFilters, setRowFilters] = useState({
    stockActual: false,
    pedido: false,
    stockMinimo: false,
  });

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      const matchesTextFilters = COLUMNS.every(({ key }) => {
        const filter = filters[key].trim().toLowerCase();

        if (!filter) {
          return true;
        }

        return String(row[key]).toLowerCase().includes(filter);
      });

      if (!matchesTextFilters) {
        return false;
      }

      if (rowFilters.stockActual && row["Stock Actual"] <= 0) {
        return false;
      }

      if (rowFilters.pedido && row.Pedido <= 0) {
        return false;
      }

      if (rowFilters.stockMinimo && row["Stock Minimo"] <= 0) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      const comparison = compareValues(a, b, sortKey);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [
    filters,
    rows,
    rowFilters.pedido,
    rowFilters.stockActual,
    rowFilters.stockMinimo,
    sortDirection,
    sortKey,
  ]);

  async function openDetail(row: StockActualRow) {
    setSelectedRow(row);
    setDetailRows([]);
    setDetailError(null);
    setDetailLoading(true);
    setEquivalentRows(null);
    setEquivalentError(null);
    setEquivalentFor(null);

    try {
      const response = await fetch(
        `/api/bodega/stock-actual/pedidos?codigo=${encodeURIComponent(row.Codigo)}`,
        { cache: "no-store" },
      );

      const payload = (await response.json()) as {
        rows?: OpenPurchaseOrderRow[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error ??
            `No fue posible cargar el detalle de pedidos (${response.status}).`,
        );
      }

      if (payload.error) {
        throw new Error(payload.error);
      }

      setDetailRows(payload.rows ?? []);
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : "No fue posible cargar el detalle de pedidos.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function searchEquivalents() {
    if (!selectedRow) {
      return;
    }

    setEquivalentError(null);
    setEquivalentRows(null);
    setEquivalentFor(selectedRow.Codigo);
    setEquivalentLoading(true);

    try {
      const response = await fetch(
        `/api/bodega/stock-actual/equivalentes?codigo=${encodeURIComponent(selectedRow.Codigo)}`,
        { cache: "no-store" },
      );

      const payload = (await response.json()) as {
        rows?: EquivalentStockRow[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error ??
            `No fue posible cargar las equivalencias (${response.status}).`,
        );
      }

      if (payload.error) {
        throw new Error(payload.error);
      }

      setEquivalentRows(payload.rows ?? []);
    } catch (error) {
      setEquivalentError(
        error instanceof Error
          ? error.message
          : "No fue posible cargar las equivalencias.",
      );
    } finally {
      setEquivalentLoading(false);
    }
  }

  function handleSort(key: ColumnKey) {
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function handleExportVisibleRows() {
    const exportRows = [
      COLUMNS.map((column) => column.label),
      ...visibleRows.map((row) =>
        COLUMNS.map((column) => {
          const value = row[column.key];

          if (typeof value === "number") {
            return formatValue(value);
          }

          return String(value);
        }),
      ),
    ];

    const dateStamp = new Intl.DateTimeFormat("sv-SE").format(new Date());
    downloadCsv(`stock-actual-${dateStamp}.csv`, exportRows);
  }

  return (
    <div className="relative mt-6 overflow-x-auto rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Resultados de stock
          </p>
          <p className="text-xs text-slate-500">
            Puedes ordenar, filtrar y abrir el detalle de pedidos.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleExportVisibleRows}
            className="rounded-full border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
          >
            Exportar Excel
          </button>
          <button
            type="button"
            onClick={() =>
              setRowFilters((current) => ({
                ...current,
                stockActual: !current.stockActual,
              }))
            }
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              rowFilters.stockActual
                ? "border-cyan-600 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Solo stock actual
          </button>
          <button
            type="button"
            onClick={() =>
              setRowFilters((current) => ({
                ...current,
                pedido: !current.pedido,
              }))
            }
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              rowFilters.pedido
                ? "border-cyan-600 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Solo pedidos
          </button>
          <button
            type="button"
            onClick={() =>
              setRowFilters((current) => ({
                ...current,
                stockMinimo: !current.stockMinimo,
              }))
            }
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              rowFilters.stockMinimo
                ? "border-cyan-600 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Solo stock m&iacute;nimo
          </button>
          <button
            type="button"
            onClick={() =>
              setRowFilters({
                stockActual: false,
                pedido: false,
                stockMinimo: false,
              })
            }
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Limpiar
          </button>
        </div>
      </div>
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            {COLUMNS.map((column) => {
              const isActive = sortKey === column.key;
              const ariaSort = isActive
                ? sortDirection === "asc"
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
                      {isActive ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
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
                  value={filters[column.key]}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      [column.key]: event.target.value,
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
              <td className="px-4 py-6 text-slate-500" colSpan={7}>
                No se encontraron articulos que coincidan con los filtros.
              </td>
            </tr>
          ) : (
            visibleRows.map((row) => {
              const isSelected =
                selectedRow?.Codigo === row.Codigo &&
                selectedRow?.Bodega === row.Bodega;

              return (
                <tr
                  key={`${row.Codigo}-${row.Bodega}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => void openDetail(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openDetail(row);
                    }
                  }}
                  className={`cursor-pointer align-top transition hover:bg-slate-50 ${
                    isSelected ? "bg-cyan-50" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {row.Codigo}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.Descripcion}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.Bodega}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-900">
                    {formatValue(row["Stock Actual"])}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.Unidad}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-900">
                    {formatValue(row.Pedido)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-900">
                    {formatValue(row["Stock Minimo"])}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {selectedRow ? (
        <>
          <button
            type="button"
            aria-label="Cerrar detalle"
            onClick={() => setSelectedRow(null)}
            className="fixed inset-0 z-10 bg-slate-950/35"
          />
          <DetailPanel
            itemCode={selectedRow.Codigo}
            description={selectedRow.Descripcion}
            rows={detailRows}
            loading={detailLoading}
            error={detailError}
            equivalentRows={equivalentRows}
            equivalentLoading={equivalentLoading}
            equivalentError={equivalentError}
            equivalentFor={equivalentFor}
            onSearchEquivalents={() => void searchEquivalents()}
            onClose={() => setSelectedRow(null)}
          />
        </>
      ) : null}
    </div>
  );
}
