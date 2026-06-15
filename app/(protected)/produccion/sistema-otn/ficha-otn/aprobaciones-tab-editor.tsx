"use client";

import { useMemo, useState, type FormEvent } from "react";
import { formatDateDdMmYyyy } from "@/lib/date-format";
import type { SistemaOtnAprobacionRow } from "@/lib/sistema-otn-aprobaciones-sql";

type FormState = {
  FechaAprobacion: string;
  ValorAprobado: string;
  OC: string;
  ReferenciaCliente: string;
};

type SortKey = "FechaAprobacion" | "ValorAprobado" | "OC" | "ReferenciaCliente";

const INITIAL_FORM: FormState = {
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

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "";
}

function sortText(left: string, right: string, direction: "asc" | "desc") {
  const factor = direction === "asc" ? 1 : -1;
  return left.localeCompare(right, "es") * factor;
}

function sortNumber(left: number, right: number, direction: "asc" | "desc") {
  const factor = direction === "asc" ? 1 : -1;
  return (left - right) * factor;
}

export function AprobacionesTabEditor({
  otn,
  initialRows,
  onChanged,
}: {
  otn: string;
  initialRows: SistemaOtnAprobacionRow[];
  onChanged?: () => Promise<void> | void;
}) {
  const [rows, setRows] = useState(initialRows);
  const [form, setForm] = useState<FormState>({
    ...INITIAL_FORM,
    FechaAprobacion: getTodayInputValue(),
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    FechaAprobacion: "",
    ValorAprobado: "",
    OC: "",
    ReferenciaCliente: "",
  });
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) =>
      (Object.keys(filters) as Array<keyof typeof filters>).every((key) => {
        const term = filters[key].trim().toLowerCase();
        if (!term) {
          return true;
        }

        const searchable = {
          FechaAprobacion: row.FechaAprobacion,
          ValorAprobado: String(row.ValorAprobado ?? ""),
          OC: row.OC ?? "",
          ReferenciaCliente: row.ReferenciaCliente ?? "",
        } as const;

        return String(searchable[key]).toLowerCase().includes(term);
      }),
    );

    if (!sort) {
      return filtered;
    }

    const sorted = [...filtered].sort((left, right) => {
      if (sort.key === "ValorAprobado") {
        return sortNumber(left.ValorAprobado ?? 0, right.ValorAprobado ?? 0, sort.direction);
      }

      if (sort.key === "FechaAprobacion") {
        return sortText(left.FechaAprobacion ?? "", right.FechaAprobacion ?? "", sort.direction);
      }

      return sortText(
        normalizeText(left[sort.key] as string | null | undefined),
        normalizeText(right[sort.key] as string | null | undefined),
        sort.direction,
      );
    });

    return sorted;
  }, [filters, rows, sort]);

  async function refreshRows() {
    const response = await fetch("/api/produccion/sistema-otn/aprobaciones", {
      cache: "no-store",
    });
    const payload = (await response.json()) as { rows?: SistemaOtnAprobacionRow[]; error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "No fue posible actualizar las aprobaciones.");
    }

    setRows((payload.rows ?? []).filter((row) => row.OTN === otn));
  }

  function resetForm() {
    setSelectedId(null);
    setForm({
      ...INITIAL_FORM,
      FechaAprobacion: getTodayInputValue(),
    });
    setError(null);
  }

  function startEdit(row: SistemaOtnAprobacionRow) {
    setSelectedId(row.Id);
    setForm({
      FechaAprobacion: row.FechaAprobacion ?? getTodayInputValue(),
      ValorAprobado: row.ValorAprobado === null || row.ValorAprobado === undefined ? "" : String(row.ValorAprobado),
      OC: row.OC ?? "",
      ReferenciaCliente: row.ReferenciaCliente ?? "",
    });
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        FechaAprobacion: form.FechaAprobacion.trim(),
        ValorAprobado: toNumberOrNull(form.ValorAprobado),
        OC: form.OC.trim() || null,
        ReferenciaCliente: form.ReferenciaCliente.trim() || null,
      };

      const response = await fetch(
        selectedId
          ? `/api/produccion/sistema-otn/aprobaciones/${selectedId}`
          : "/api/produccion/sistema-otn/aprobaciones",
        {
          method: selectedId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            OTN: otn,
          }),
        },
      );

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "No fue posible guardar la aprobación.");
      }

      await refreshRows();
      await onChanged?.();
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

  async function handleDelete(row: SistemaOtnAprobacionRow) {
    const confirmed = window.confirm(`¿Eliminar la aprobación del ${row.FechaAprobacion}?`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/produccion/sistema-otn/aprobaciones/${row.Id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "No fue posible eliminar la aprobación.");
      }

      if (selectedId === row.Id) {
        resetForm();
      }

      await refreshRows();
      await onChanged?.();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No fue posible eliminar la aprobación.",
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
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="grid gap-4">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-700">
                Registro
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {selectedId ? "Editar aprobación" : "Nueva aprobación"}
              </h3>
            </div>

            {selectedId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Limpiar
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">OTN</label>
              <input value={otn} disabled className={`${fieldClassName()} bg-slate-50`} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Fecha aprobación
                </label>
                <input
                  type="date"
                  required
                  value={form.FechaAprobacion}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, FechaAprobacion: event.target.value }))
                  }
                  className={fieldClassName()}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Valor aprobado
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={form.ValorAprobado}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, ValorAprobado: event.target.value }))
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
                Ref. cliente
              </label>
              <input
                value={form.ReferenciaCliente}
                onChange={(event) =>
                  setForm((current) => ({ ...current, ReferenciaCliente: event.target.value }))
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
                {saving ? "Guardando..." : selectedId ? "Actualizar" : "Crear aprobación"}
              </button>
              {selectedId ? (
                <button
                  type="button"
                  onClick={() => {
                    const row = rows.find((item) => item.Id === selectedId);
                    if (row) {
                      void handleDelete(row);
                    }
                  }}
                  disabled={saving}
                  className="inline-flex items-center rounded-full border border-red-300 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Eliminar
                </button>
              ) : null}
            </div>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-700">
            Tabla
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Aprobaciones
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {visibleRows.length} registro{visibleRows.length === 1 ? "" : "s"} visible
            {Object.values(filters).some(Boolean) ? " con filtro activo" : ""}.
          </p>
        </div>

        <div className="grid gap-3 p-4">
          <div className="grid gap-2 md:grid-cols-4">
            {(
              [
                ["FechaAprobacion", "Fecha aprobación"],
                ["ValorAprobado", "Valor aprobado"],
                ["OC", "OC"],
                ["ReferenciaCliente", "Ref. cliente"],
              ] as Array<[SortKey, string]>
            ).map(([key, label]) => (
              <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                <button
                  type="button"
                  onClick={() => toggleSort(key)}
                  className="mb-2 flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 hover:text-slate-900"
                >
                  <span>{label}</span>
                  <span>{sort?.key === key ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}</span>
                </button>
                <input
                  value={filters[key]}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, [key]: event.target.value }))
                  }
                  className={compactFieldClassName()}
                  placeholder={`Filtrar ${label}`}
                />
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Fecha aprobación</th>
                  <th className="px-4 py-3 font-semibold text-right">Valor aprobado</th>
                  <th className="px-4 py-3 font-semibold">OC</th>
                  <th className="px-4 py-3 font-semibold">Ref. cliente</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visibleRows.length ? (
                  visibleRows.map((row) => (
                    <tr
                      key={row.Id}
                      className="transition hover:bg-slate-100 hover:shadow-[inset_0_0_0_9999px_rgba(15,23,42,0.02)]"
                    >
                      <td className="px-4 py-3 text-slate-700">
                        {formatDateDdMmYyyy(row.FechaAprobacion)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatNumber(row.ValorAprobado)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.OC ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.ReferenciaCliente ?? "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className="rounded-full border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-900 transition hover:bg-cyan-100"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(row)}
                            className="rounded-full border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No hay aprobaciones registradas para esta OTN.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
