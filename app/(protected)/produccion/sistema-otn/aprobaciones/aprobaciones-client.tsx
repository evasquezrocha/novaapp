"use client";

import { useMemo, useState, type FormEvent } from "react";
import { formatDateDdMmYyyy } from "@/lib/date-format";
import type { SistemaOtnAprobacionRow } from "@/lib/sistema-otn-aprobaciones-sql";
import type { SistemaOtnRow } from "@/lib/sistema-otn-sql";

type FormState = {
  OTN: string;
  FechaAprobacion: string;
  ValorAprobado: string;
  OC: string;
  ReferenciaCliente: string;
};

const INITIAL_FORM: FormState = {
  OTN: "",
  FechaAprobacion: "",
  ValorAprobado: "",
  OC: "",
  ReferenciaCliente: "",
};

function getTodayInputValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
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

function fieldClassName() {
  return "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100";
}

function compactFieldClassName() {
  return "h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-100";
}

function tableClassName() {
  return "min-w-full divide-y divide-slate-200 text-left text-sm";
}

function summaryItems(row: SistemaOtnRow | null) {
  if (!row) {
    return [];
  }

  return [
    ["OTN", row.OTN],
    ["Estado", row.Estado ?? "-"],
    ["Fecha ingreso", row.FechaIngreso ? formatDateDdMmYyyy(row.FechaIngreso) : "-"],
    ["Cliente", row.Cliente ?? "-"],
    ["Empresa", row.Empresa ?? "-"],
    ["Solicitante", row.Solicitante ?? "-"],
    ["CC", row.CC ?? "-"],
    ["Cantidad", row.Cantidad === null ? "-" : formatNumber(row.Cantidad)],
    ["Descripción", row.Descripcion ?? "-"],
    ["Ref. cliente", row.ReferenciaCliente ?? "-"],
    ["Cotizador", row.Cotizador ?? "-"],
    ["Equipo", row.Equipo ?? "-"],
    ["Fecha ppto", row.FechaPpto ? formatDateDdMmYyyy(row.FechaPpto) : "-"],
    ["Valor ppto", row.ValorPpto === null ? "-" : formatNumber(row.ValorPpto)],
    ["Plazo", row.Plazo ?? "-"],
    ["Observaciones", row.Observaciones ?? "-"],
    ["Ruta", row.Ruta ?? "-"],
  ] as const;
}

function normalizeKey(value: string) {
  return value.toLowerCase();
}

export function AprobacionesClient({
  initialRows,
}: {
  initialRows: SistemaOtnAprobacionRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [selectedOtn, setSelectedOtn] = useState<SistemaOtnRow | null>(null);
  const [otnQuery, setOtnQuery] = useState("");
  const [form, setForm] = useState<FormState>({
    ...INITIAL_FORM,
    FechaAprobacion: getTodayInputValue(),
  });
  const [loadingOtn, setLoadingOtn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => summaryItems(selectedOtn), [selectedOtn]);

  const tableColumns = useMemo(
    () =>
      [
        { key: "OTN", label: "OTN" },
        { key: "FechaAprobacion", label: "Fecha Aprobación" },
        { key: "ValorAprobado", label: "Valor Aprobado", alignRight: true },
        { key: "OC", label: "OC" },
        { key: "ReferenciaCliente", label: "Ref. Cliente" },
      ] as const,
    [],
  );

  const normalizedRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        FechaAprobacionKey: row.FechaAprobacion ?? "",
        ValorAprobadoKey: row.ValorAprobado ?? 0,
        OCKey: row.OC ?? "",
        ReferenciaClienteKey: row.ReferenciaCliente ?? "",
      })),
    [rows],
  );

  const [filters, setFilters] = useState({
    OTN: "",
    FechaAprobacion: "",
    ValorAprobado: "",
    OC: "",
    ReferenciaCliente: "",
  });
  const [sort, setSort] = useState<{
    key: "OTN" | "FechaAprobacion" | "ValorAprobado" | "OC" | "ReferenciaCliente";
    direction: "asc" | "desc";
  } | null>(null);

  const visibleRows = useMemo(() => {
    const filtered = normalizedRows.filter((row) => {
      const searchable = {
        OTN: row.OTN,
        FechaAprobacion: row.FechaAprobacionKey,
        ValorAprobado: String(row.ValorAprobadoKey),
        OC: row.OCKey,
        ReferenciaCliente: row.ReferenciaClienteKey,
      } as const;

      return (Object.keys(filters) as Array<keyof typeof filters>).every((key) => {
        const term = normalizeKey(filters[key].trim());
        if (!term) {
          return true;
        }

        return normalizeKey(searchable[key]).includes(term);
      });
    });

    if (!sort) {
      return filtered;
    }

    const factor = sort.direction === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((left, right) => {
      if (sort.key === "ValorAprobado") {
        return ((left.ValorAprobadoKey ?? 0) - (right.ValorAprobadoKey ?? 0)) * factor;
      }

      if (sort.key === "FechaAprobacion") {
        return String(left.FechaAprobacionKey).localeCompare(String(right.FechaAprobacionKey)) * factor;
      }

      return String(left[sort.key as keyof typeof left] ?? "").localeCompare(
        String(right[sort.key as keyof typeof right] ?? ""),
        "es",
      ) * factor;
    });

    return sorted;
  }, [filters, normalizedRows, sort]);

  async function refreshRows() {
    const response = await fetch("/api/produccion/sistema-otn/aprobaciones", {
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      rows?: SistemaOtnAprobacionRow[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "No fue posible actualizar la tabla.");
    }

    setRows(payload.rows ?? []);
  }

  async function searchOtn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = otnQuery.trim();

    if (!trimmed) {
      setSelectedOtn(null);
      setError("Escribe una OTN para buscar.");
      return;
    }

    setLoadingOtn(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/produccion/sistema-otn/buscar?otn=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        row?: SistemaOtnRow;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible buscar la OTN.");
      }

      setSelectedOtn(payload.row ?? null);
      setForm((current) => ({
        ...current,
        OTN: payload.row?.OTN ?? trimmed,
        ReferenciaCliente: payload.row?.ReferenciaCliente ?? current.ReferenciaCliente,
      }));
    } catch (searchError) {
      setSelectedOtn(null);
      setError(
        searchError instanceof Error ? searchError.message : "No fue posible buscar la OTN.",
      );
    } finally {
      setLoadingOtn(false);
    }
  }

  function resetForm() {
    setForm({
      ...INITIAL_FORM,
      FechaAprobacion: getTodayInputValue(),
      OTN: otnQuery.trim(),
      ReferenciaCliente: selectedOtn?.ReferenciaCliente ?? "",
    });
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        OTN: form.OTN.trim(),
        FechaAprobacion: form.FechaAprobacion.trim(),
        ValorAprobado: toNumberOrNull(form.ValorAprobado),
        OC: form.OC.trim() || null,
        ReferenciaCliente: form.ReferenciaCliente.trim() || null,
      };

      const response = await fetch("/api/produccion/sistema-otn/aprobaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "No fue posible guardar la aprobación.");
      }

      await refreshRows();
      resetForm();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible guardar la aprobación.",
      );
    } finally {
      setSaving(false);
    }
  }

  function toggleSort(key: keyof typeof filters) {
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
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="grid gap-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-700">
              Búsqueda
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Buscar OTN
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Escribe una OTN y carga su información para completar la aprobación.
            </p>
          </div>

          <form onSubmit={searchOtn} className="mt-6 grid gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">OTN</label>
              <input
                value={otnQuery}
                onChange={(event) => setOtnQuery(event.target.value)}
                className={fieldClassName()}
                placeholder="OTN"
              />
            </div>

            <button
              type="submit"
              disabled={loadingOtn}
              className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingOtn ? "Buscando..." : "Buscar"}
            </button>
          </form>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-700">
              Registro
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Nueva Aprobación
            </h3>
          </div>

          <div className="mt-6 grid gap-4">
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Fecha Aprobación
                </label>
                <input
                  type="date"
                  required
                  value={form.FechaAprobacion}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      FechaAprobacion: event.target.value,
                    }))
                  }
                  className={fieldClassName()}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Valor Aprobado
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={form.ValorAprobado}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ValorAprobado: event.target.value,
                    }))
                  }
                  className={fieldClassName()}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">OC</label>
              <input
                value={form.OC}
                onChange={(event) => setForm((current) => ({ ...current, OC: event.target.value }))}
                className={fieldClassName()}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Ref. Cliente
              </label>
              <input
                value={form.ReferenciaCliente}
                onChange={(event) =>
                  setForm((current) => ({ ...current, ReferenciaCliente: event.target.value }))
                }
                className={fieldClassName()}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Crear aprobación"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Limpiar
              </button>
            </div>
          </div>
        </form>

        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-700">
              Detalle OTN
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Información encontrada
            </h3>
          </div>

          {selectedOtn ? (
            <dl className="mt-6 grid gap-4 md:grid-cols-2">
              {summary.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-2 text-sm leading-6 text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
              Busca una OTN para ver aquí todo su detalle.
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-700">
              Tabla
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Aprobaciones
            </h3>
          </div>

          <div className="grid gap-3 p-4">
            <div className="grid gap-2 md:grid-cols-5">
              {tableColumns.map((column) => (
                <div
                  key={column.key}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className="mb-2 flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 hover:text-slate-900"
                  >
                    <span>{column.label}</span>
                    <span>
                      {sort?.key === column.key ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                  <input
                    value={filters[column.key]}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, [column.key]: event.target.value }))
                    }
                    className={compactFieldClassName()}
                    placeholder={`Filtrar ${column.label}`}
                  />
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className={tableClassName()}>
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    {tableColumns.map((column) => (
                      <th
                        key={column.key}
                        className={`px-6 py-3 ${"alignRight" in column && column.alignRight ? "text-right" : ""}`}
                      >
                        {sort?.key === column.key
                          ? `${column.label} ${sort.direction === "asc" ? "▲" : "▼"}`
                          : column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.length > 0 ? (
                    visibleRows.map((row) => (
                      <tr key={row.Id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-slate-900">{row.OTN}</td>
                        <td className="px-6 py-4 text-slate-700">
                          {formatDateDdMmYyyy(row.FechaAprobacion)}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-700">
                          {formatNumber(row.ValorAprobado)}
                        </td>
                        <td className="px-6 py-4 text-slate-700">{row.OC ?? "-"}</td>
                        <td className="px-6 py-4 text-slate-700">
                          {row.ReferenciaCliente ?? "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                        Todavía no hay aprobaciones registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
