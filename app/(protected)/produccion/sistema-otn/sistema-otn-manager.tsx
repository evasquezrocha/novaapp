"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatDateDdMmYyyy } from "@/lib/date-format";
import type { SistemaOtnRow } from "@/lib/sistema-otn-sql";

type FormState = {
  OTN: string;
  FechaIngreso: string;
  Cliente: string;
  Empresa: string;
  Solicitante: string;
  CC: string;
  Cantidad: string;
  Descripcion: string;
  ReferenciaCliente: string;
  Cotizador: string;
  Equipo: string;
  FechaPpto: string;
  ValorPpto: string;
  Plazo: string;
  Observaciones: string;
  Ruta: string;
};

type SortKey =
  | "OTN"
  | "Estado"
  | "FechaIngreso"
  | "Cliente"
  | "Empresa"
  | "Solicitante"
  | "CC"
  | "Cantidad"
  | "Descripcion"
  | "ReferenciaCliente"
  | "Cotizador"
  | "Equipo"
  | "TotalPresupuesto"
  | "TotalAprobado"
  | "TotalEntregado"
  | "TotalFacturado"
  | "TotalNotasCredito"
  | "TotalPendiente";

const INITIAL_FORM: FormState = {
  OTN: "",
  FechaIngreso: "",
  Cliente: "",
  Empresa: "",
  Solicitante: "",
  CC: "",
  Cantidad: "",
  Descripcion: "",
  ReferenciaCliente: "",
  Cotizador: "",
  Equipo: "Sí",
  FechaPpto: "",
  ValorPpto: "",
  Plazo: "",
  Observaciones: "",
  Ruta: "",
};

const TABLE_COLUMNS: Array<{
  key:
    | SortKey
    | "Descripcion"
    | "ReferenciaCliente"
    | "Cotizador"
    | "Equipo"
    | "Acciones";
  label: string;
  sortable: boolean;
}> = [
  { key: "Empresa", label: "Empresa", sortable: true },
  { key: "OTN", label: "OTN", sortable: true },
  { key: "Estado", label: "Estado", sortable: true },
  { key: "FechaIngreso", label: "Fecha ingreso", sortable: true },
  { key: "Cliente", label: "Cliente", sortable: true },
  { key: "Solicitante", label: "Solicitante", sortable: true },
  { key: "CC", label: "CC", sortable: true },
  { key: "Cantidad", label: "Cantidad", sortable: true },
  { key: "Descripcion", label: "Descripción", sortable: false },
  { key: "ReferenciaCliente", label: "Ref. cliente", sortable: false },
  { key: "Cotizador", label: "Cotizador", sortable: false },
  { key: "Equipo", label: "Equipo", sortable: false },
  { key: "TotalPresupuesto", label: "Total Presupuesto", sortable: true },
  { key: "TotalAprobado", label: "Total Aprobado", sortable: true },
  { key: "TotalEntregado", label: "Total Entregado", sortable: true },
  { key: "TotalFacturado", label: "Total Facturado", sortable: true },
  { key: "TotalNotasCredito", label: "Total NC", sortable: true },
  { key: "TotalPendiente", label: "Total Pendiente", sortable: true },
  { key: "Acciones", label: "Acciones", sortable: false },
];

function fieldClassName() {
  return "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100";
}

function toInputValue(value: string | null | undefined) {
  return value ?? "";
}

function getTodayInputValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function getNextOtnValue(rows: SistemaOtnRow[]) {
  const highest = rows.reduce((currentHighest, row) => {
    const parsed = Number(row.OTN);
    return Number.isFinite(parsed) ? Math.max(currentHighest, parsed) : currentHighest;
  }, 0);

  return String(highest + 1).padStart(4, "0");
}

function normalizeEquipoValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() === "no" ? "No" : "Sí";
}

function normalizeEmpresaValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toNumberOrNull(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function StatBox({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "cyan" | "emerald" | "amber" | "indigo" | "rose";
}) {
  const toneClassName = {
    slate: "border-slate-200 bg-white text-slate-950 shadow-sm",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-950 shadow-sm shadow-cyan-100/60",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm shadow-emerald-100/60",
    amber: "border-amber-200 bg-amber-50 text-amber-950 shadow-sm shadow-amber-100/60",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-950 shadow-sm shadow-indigo-100/60",
    rose: "border-rose-200 bg-rose-50 text-rose-950 shadow-sm shadow-rose-100/60",
  }[tone];

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClassName}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] opacity-70">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function sumTotals(rows: SistemaOtnRow[]) {
  return rows.reduce(
    (accumulator, row) => ({
      totalPresupuesto: accumulator.totalPresupuesto + (row.TotalPresupuesto ?? 0),
      totalAprobado: accumulator.totalAprobado + (row.TotalAprobado ?? 0),
      totalEntregado: accumulator.totalEntregado + (row.TotalEntregado ?? 0),
      totalFacturado: accumulator.totalFacturado + (row.TotalFacturado ?? 0),
      totalNotasCredito: accumulator.totalNotasCredito + (row.TotalNotasCredito ?? 0),
      totalPendiente: accumulator.totalPendiente + (row.TotalPendiente ?? 0),
    }),
    {
      totalPresupuesto: 0,
      totalAprobado: 0,
      totalEntregado: 0,
      totalFacturado: 0,
      totalNotasCredito: 0,
      totalPendiente: 0,
    },
  );
}

function getUniqueOptions(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right, "es"));
}

function getEstadoDisplay(row: SistemaOtnRow) {
  return row.EstadoDerivado ?? row.Estado ?? "Ingresado";
}

function stateBadgeClassName(estado: string) {
  const normalized = estado.toLowerCase();

  if (normalized === "pagado") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (normalized === "facturado") {
    return "border-indigo-200 bg-indigo-50 text-indigo-800";
  }
  if (normalized === "entregado") {
    return "border-cyan-200 bg-cyan-50 text-cyan-800";
  }
  if (normalized === "aprobado") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function matchesSearch(row: SistemaOtnRow, search: string) {
  if (!search) {
    return true;
  }

  const haystack = [
    row.OTN,
    getEstadoDisplay(row),
    row.FechaIngreso,
    row.Cliente,
    row.Empresa,
    row.Solicitante,
    row.CC,
    row.Cantidad?.toString(),
    row.Descripcion,
    row.ReferenciaCliente,
    row.Cotizador,
    row.Equipo,
    row.FechaPpto,
    row.ValorPpto?.toString(),
    row.TotalPresupuesto?.toString(),
    row.TotalAprobado?.toString(),
    row.TotalEntregado?.toString(),
    row.TotalFacturado?.toString(),
    row.TotalNotasCredito?.toString(),
    row.TotalPendiente?.toString(),
    row.Plazo,
    row.Observaciones,
    row.Ruta,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(search);
}

function compareText(left: string, right: string, direction: "asc" | "desc") {
  const factor = direction === "asc" ? 1 : -1;
  return left.localeCompare(right, "es") * factor;
}

function compareNumber(left: number, right: number, direction: "asc" | "desc") {
  const factor = direction === "asc" ? 1 : -1;
  return (left - right) * factor;
}

function getFilterableCellValue(row: SistemaOtnRow, key: string) {
  switch (key) {
    case "Empresa":
      return row.Empresa ?? "";
    case "OTN":
      return row.OTN ?? "";
    case "Estado":
      return getEstadoDisplay(row);
    case "FechaIngreso":
      return row.FechaIngreso ? formatDateDdMmYyyy(row.FechaIngreso) : "";
    case "Cliente":
      return row.Cliente ?? "";
    case "Solicitante":
      return row.Solicitante ?? "";
    case "CC":
      return row.CC ?? "";
    case "Cantidad":
      return formatNumber(row.Cantidad);
    case "Descripcion":
      return row.Descripcion ?? "";
    case "ReferenciaCliente":
      return row.ReferenciaCliente ?? "";
    case "Cotizador":
      return row.Cotizador ?? "";
    case "Equipo":
      return row.Equipo ?? "";
    case "TotalPresupuesto":
      return formatCurrency(row.TotalPresupuesto);
    case "TotalAprobado":
      return formatCurrency(row.TotalAprobado);
    case "TotalEntregado":
      return formatCurrency(row.TotalEntregado);
    case "TotalFacturado":
      return formatCurrency(row.TotalFacturado);
    case "TotalNotasCredito":
      return formatCurrency(row.TotalNotasCredito);
    case "TotalPendiente":
      return formatCurrency(row.TotalPendiente);
    default:
      return "";
  }
}

export function SistemaOtnManager({ initialRows }: { initialRows: SistemaOtnRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [searchTerm, setSearchTerm] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRow = useMemo(
    () => rows.find((row) => row.Id === selectedId) ?? null,
    [rows, selectedId],
  );

  const selectableOptions = useMemo(
    () => ({
      Cliente: getUniqueOptions(rows.map((row) => row.Cliente)),
      Empresa: getUniqueOptions([
        ...rows.map((row) => row.Empresa),
        "Novamine Chile",
        "Novamine",
      ]),
      Solicitante: getUniqueOptions(rows.map((row) => row.Solicitante)),
      CC: getUniqueOptions(rows.map((row) => row.CC)),
      Cotizador: getUniqueOptions(rows.map((row) => row.Cotizador)),
    }),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (!matchesSearch(row, search)) {
        return false;
      }

      return Object.entries(columnFilters).every(([key, value]) => {
        const trimmed = value.trim().toLowerCase();

        if (!trimmed) {
          return true;
        }

        return getFilterableCellValue(row, key).toLowerCase().includes(trimmed);
      });
    });

    if (!sort) {
      return filtered;
    }

    return [...filtered].sort((left, right) => {
      if (
        sort.key === "Cantidad" ||
        sort.key === "TotalPresupuesto" ||
        sort.key === "TotalAprobado" ||
        sort.key === "TotalEntregado" ||
        sort.key === "TotalFacturado" ||
        sort.key === "TotalNotasCredito" ||
        sort.key === "TotalPendiente"
      ) {
        return compareNumber(
          Number(left[sort.key] ?? 0) || 0,
          Number(right[sort.key] ?? 0) || 0,
          sort.direction,
        );
      }

      if (sort.key === "FechaIngreso") {
        return compareText(String(left[sort.key] ?? ""), String(right[sort.key] ?? ""), sort.direction);
      }

      if (sort.key === "Estado") {
        return compareText(getEstadoDisplay(left), getEstadoDisplay(right), sort.direction);
      }

      return compareText(String(left[sort.key] ?? ""), String(right[sort.key] ?? ""), sort.direction);
    });
  }, [rows, searchTerm, sort, columnFilters]);

  const filteredTotals = useMemo(() => sumTotals(filteredRows), [filteredRows]);

  function getCreateFormDefaults(sourceRows: SistemaOtnRow[]) {
    return {
      ...INITIAL_FORM,
      OTN: getNextOtnValue(sourceRows),
      FechaIngreso: getTodayInputValue(),
    };
  }

  function resetForm(sourceRows: SistemaOtnRow[] = rows) {
    setSelectedId(null);
    setForm(getCreateFormDefaults(sourceRows));
    setError(null);
  }

  function clearListFilters() {
    setSearchTerm("");
    setColumnFilters({});
  }

  function openCreateForm() {
    setShowForm(true);
    resetForm(rows);
  }

  function openEditForm(row: SistemaOtnRow) {
    setShowForm(true);
    setSelectedId(row.Id);
    setForm({
      OTN: row.OTN,
      FechaIngreso: toInputValue(row.FechaIngreso),
      Cliente: toInputValue(row.Cliente),
      Empresa: toInputValue(row.Empresa),
      Solicitante: toInputValue(row.Solicitante),
      CC: toInputValue(row.CC),
      Cantidad: row.Cantidad === null || row.Cantidad === undefined ? "" : String(row.Cantidad),
      Descripcion: toInputValue(row.Descripcion),
      ReferenciaCliente: toInputValue(row.ReferenciaCliente),
      Cotizador: toInputValue(row.Cotizador),
      Equipo: row.Equipo ?? "Sí",
      FechaPpto: toInputValue(row.FechaPpto),
      ValorPpto: row.ValorPpto === null || row.ValorPpto === undefined ? "" : String(row.ValorPpto),
      Plazo: toInputValue(row.Plazo),
      Observaciones: toInputValue(row.Observaciones),
      Ruta: toInputValue(row.Ruta),
    });
    setError(null);
  }

  async function refreshRows() {
    const response = await fetch("/api/produccion/sistema-otn", { cache: "no-store" });
    const payload = (await response.json()) as { rows?: SistemaOtnRow[]; error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "No fue posible actualizar la tabla.");
    }

    const nextRows = payload.rows ?? [];
    setRows(nextRows);
    return nextRows;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        OTN: form.OTN.trim(),
        FechaIngreso: form.FechaIngreso.trim() || null,
        Cliente: form.Cliente.trim() || null,
        Empresa: normalizeEmpresaValue(form.Empresa),
        Solicitante: form.Solicitante.trim() || null,
        CC: form.CC.trim() || null,
        Cantidad: toNumberOrNull(form.Cantidad),
        Descripcion: form.Descripcion.trim() || null,
        ReferenciaCliente: form.ReferenciaCliente.trim() || null,
        Cotizador: form.Cotizador.trim() || null,
        Equipo: normalizeEquipoValue(form.Equipo),
        FechaPpto: form.FechaPpto.trim() || null,
        ValorPpto: toNumberOrNull(form.ValorPpto),
        Plazo: form.Plazo.trim() || null,
        Observaciones: form.Observaciones.trim() || null,
        Ruta: form.Ruta.trim() || null,
      };

      const response = await fetch(
        selectedId ? `/api/produccion/sistema-otn/${selectedId}` : "/api/produccion/sistema-otn",
        {
          method: selectedId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "No fue posible guardar el registro.");
      }

      const updatedRows = await refreshRows();
      setShowForm(false);
      resetForm(updatedRows);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible guardar el registro.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedId) {
      return;
    }

    const confirmed = window.confirm(`¿Eliminar el registro OTN ${form.OTN}?`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/produccion/sistema-otn/${selectedId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "No fue posible eliminar el registro.");
      }

      const updatedRows = await refreshRows();
      setShowForm(false);
      resetForm(updatedRows);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No fue posible eliminar el registro.",
      );
    } finally {
      setSaving(false);
    }
  }

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }

      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }

      return null;
    });
  }

  return (
    <div className="grid gap-4">
      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">
                Registro
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {selectedId ? "Editar Sistema OTN" : "Nuevo Sistema OTN"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                El estado se calcula automáticamente y se muestra en el listado.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => resetForm(rows)}
                className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="grid gap-4 xl:grid-cols-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Empresa</label>
                <select
                  value={form.Empresa}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, Empresa: event.target.value }))
                  }
                  className={fieldClassName()}
                >
                  <option value="">Seleccione una empresa</option>
                  {selectableOptions.Empresa.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">OTN</label>
                <input
                  required
                  value={form.OTN}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, OTN: event.target.value }))
                  }
                  className={fieldClassName()}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Fecha ingreso
                </label>
                <input
                  type="date"
                  value={form.FechaIngreso}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, FechaIngreso: event.target.value }))
                  }
                  className={fieldClassName()}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">CC</label>
                <input
                  list="sistema-otn-cc"
                  value={form.CC}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, CC: event.target.value }))
                  }
                  className={fieldClassName()}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Solicitante</label>
                <input
                  list="sistema-otn-solicitantes"
                  value={form.Solicitante}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, Solicitante: event.target.value }))
                  }
                  className={fieldClassName()}
                />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Cliente</label>
                <input
                  list="sistema-otn-clientes"
                  value={form.Cliente}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, Cliente: event.target.value }))
                  }
                  className={fieldClassName()}
                />
              </div>
              <div className="xl:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Descripción</label>
                <textarea
                  rows={3}
                  value={form.Descripcion}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, Descripcion: event.target.value }))
                  }
                  className={fieldClassName()}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Cantidad</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.Cantidad}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, Cantidad: event.target.value }))
                  }
                  className={fieldClassName()}
                />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Referencia cliente
                </label>
                <input
                  value={form.ReferenciaCliente}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, ReferenciaCliente: event.target.value }))
                  }
                  className={fieldClassName()}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Cotizador</label>
                <input
                  list="sistema-otn-cotizadores"
                  value={form.Cotizador}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, Cotizador: event.target.value }))
                  }
                  className={fieldClassName()}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Equipo</label>
                <select
                  value={form.Equipo}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, Equipo: event.target.value }))
                  }
                  className={fieldClassName()}
                >
                  <option value="Sí">Sí</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Fecha Presupuesto
                </label>
                <input
                  type="date"
                  value={form.FechaPpto}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, FechaPpto: event.target.value }))
                  }
                  className={fieldClassName()}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Valor Presupuesto
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.ValorPpto}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, ValorPpto: event.target.value }))
                  }
                  className={fieldClassName()}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Plazo (Días)
                </label>
                <input
                  value={form.Plazo}
                  onChange={(event) => setForm((current) => ({ ...current, Plazo: event.target.value }))}
                  className={fieldClassName()}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Ruta</label>
              <input
                value={form.Ruta}
                onChange={(event) => setForm((current) => ({ ...current, Ruta: event.target.value }))}
                className={fieldClassName()}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Observaciones</label>
              <textarea
                rows={4}
                value={form.Observaciones}
                onChange={(event) =>
                  setForm((current) => ({ ...current, Observaciones: event.target.value }))
                }
                className={fieldClassName()}
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Guardando..." : selectedId ? "Actualizar" : "Registrar"}
              </button>
              {selectedId ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="inline-flex items-center rounded-full border border-red-300 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Eliminar
                </button>
              ) : null}
            </div>
          </div>

          <datalist id="sistema-otn-clientes">
            {selectableOptions.Cliente.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <datalist id="sistema-otn-solicitantes">
            {selectableOptions.Solicitante.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <datalist id="sistema-otn-cc">
            {selectableOptions.CC.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <datalist id="sistema-otn-cotizadores">
            {selectableOptions.Cotizador.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.55)]">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-5 py-5 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-100">
                Listado
              </div>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Sistema OTN
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-200">
                {filteredRows.length} registro{filteredRows.length === 1 ? "" : "s"} visible
                {searchTerm.trim() ? " con filtro activo" : ""}.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Filtrar listado"
                className={`${fieldClassName()} min-w-[260px] border-white/20 bg-white/95 text-slate-950 placeholder:text-slate-500`}
              />
              <button
                type="button"
                onClick={clearListFilters}
                className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                onClick={showForm ? () => setShowForm(false) : openCreateForm}
                className="rounded-full bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                {showForm ? "Ocultar formulario" : "Nueva OTN"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatBox
              label="Total Presupuesto"
              value={formatCurrency(filteredTotals.totalPresupuesto)}
              tone="cyan"
            />
            <StatBox
              label="Total Aprobado"
              value={formatCurrency(filteredTotals.totalAprobado)}
              tone="amber"
            />
            <StatBox
              label="Total Entregado"
              value={formatCurrency(filteredTotals.totalEntregado)}
              tone="emerald"
            />
            <StatBox
              label="Total Facturado"
              value={formatCurrency(filteredTotals.totalFacturado)}
              tone="indigo"
            />
            <StatBox
              label="Total NC"
              value={formatCurrency(filteredTotals.totalNotasCredito)}
              tone="rose"
            />
            <StatBox
              label="Total Pendiente"
              value={formatCurrency(filteredTotals.totalPendiente)}
              tone="slate"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[2200px] divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                {TABLE_COLUMNS.map((column) => (
                  <th key={column.key} className="px-4 py-3 font-semibold">
                    {column.key === "Acciones" ? (
                      column.label
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key as SortKey)}
                        className="flex items-center gap-2 text-left"
                      >
                        <span>{column.label}</span>
                        <span className="text-[10px] text-slate-500">
                          {sort?.key === column.key
                            ? sort.direction === "asc"
                              ? "▲"
                              : "▼"
                            : "↕"}
                        </span>
                      </button>
                    )}
                  </th>
                ))}
              </tr>
              <tr className="border-t border-slate-200">
                {TABLE_COLUMNS.map((column) => (
                  <th key={`filter-${column.key}`} className="px-4 py-2 align-top">
                    {column.key === "Acciones" ? null : (
                      <input
                        value={columnFilters[String(column.key)] ?? ""}
                        onChange={(event) =>
                          setColumnFilters((current) => ({
                            ...current,
                            [String(column.key)]: event.target.value,
                          }))
                        }
                        placeholder={`Filtrar ${column.label.toLowerCase()}`}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-100"
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-slate-500" colSpan={TABLE_COLUMNS.length}>
                    No hay registros para mostrar.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const estado = getEstadoDisplay(row);
                  const active = row.Id === selectedId;

                  return (
                    <tr key={row.Id} className={active ? "bg-cyan-50/40" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3 text-slate-700">{row.Empresa ?? "-"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/produccion/sistema-otn/ficha-otn?otn=${encodeURIComponent(row.OTN)}`,
                            )
                          }
                          className="text-left hover:underline"
                        >
                          {row.OTN}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stateBadgeClassName(
                            estado,
                          )}`}
                        >
                          {estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.FechaIngreso ? formatDateDdMmYyyy(row.FechaIngreso) : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.Cliente ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.Solicitante ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.CC ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{formatNumber(row.Cantidad)}</td>
                      <td className="px-4 py-3 text-slate-700">{row.Descripcion ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.ReferenciaCliente ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.Cotizador ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.Equipo ?? "Sí"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatCurrency(row.TotalPresupuesto)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatCurrency(row.TotalAprobado)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatCurrency(row.TotalEntregado)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatCurrency(row.TotalFacturado)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatCurrency(row.TotalNotasCredito)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatCurrency(row.TotalPendiente)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(row)}
                            className="rounded-full border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-900 transition hover:bg-cyan-100"
                          >
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {selectedRow ? (
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-600">
            Editando <span className="font-semibold text-slate-900">{selectedRow.OTN}</span>.
          </div>
        ) : null}
      </div>
    </div>
  );
}

