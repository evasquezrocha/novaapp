"use client";

import { useEffect, useState } from "react";
import { formatDateTimeDdMmYyyy } from "@/lib/date-format";
import type { CtSupervisoresEstado, CtSupervisoresRow } from "@/lib/ct-supervisores-sql";

type DraftRow = {
  key: string;
  lugar: string;
  entrada: string;
  salida: string;
  dias: "0.25" | "1";
};

type FormState = {
  nombre: string;
  correlativo: string;
  estado: CtSupervisoresEstado;
  rows: DraftRow[];
};

type HistoryRow = {
  Id: number;
  Correlativo: string;
  Accion: string;
  EditadoPorUsuario: string;
  EditadoPorNombre: string;
  EditadoPorRol: string;
  EditadoEn: string;
  CambiosJson: string;
  Cambios?: {
    beforeRows: Array<Record<string, string | number>>;
    afterRows: Array<Record<string, string | number>>;
    changes: Array<{
      row: number;
      field: string;
      before: string | null;
      after: string | null;
    }>;
  } | null;
};

type ApiResponse = {
  error?: string;
  rows?: CtSupervisoresRow[];
  affectedRows?: CtSupervisoresRow[];
  deletedCorrelativo?: string;
  nextCorrelativo?: string;
  history?: HistoryRow[];
};

const CT_SUPERVISORES_ESTADOS: CtSupervisoresEstado[] = [
  "Ingresado",
  "Rechazado",
  "Aprobado Gerencia",
  "Ingresado a Liquidación",
  "Ingresado a Vacaciones",
];

type EstadoTone = {
  badge: string;
  text: string;
};

const ESTADO_TONES: Record<CtSupervisoresEstado, EstadoTone> = {
  Ingresado: { badge: "bg-slate-100 text-slate-700 border-slate-200", text: "text-slate-900" },
  Rechazado: { badge: "bg-rose-100 text-rose-700 border-rose-200", text: "text-rose-700" },
  "Aprobado Gerencia": {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    text: "text-emerald-800",
  },
  "Ingresado a Liquidación": {
    badge: "bg-cyan-100 text-cyan-800 border-cyan-200",
    text: "text-cyan-800",
  },
  "Ingresado a Vacaciones": {
    badge: "bg-violet-100 text-violet-800 border-violet-200",
    text: "text-violet-800",
  },
};

function getEstadoTone(estado: CtSupervisoresEstado) {
  return ESTADO_TONES[estado];
}

function createDraftRow(): DraftRow {
  return {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    lugar: "",
    entrada: "",
    salida: "",
    dias: "1",
  };
}

function createEmptyForm(nombre: string, correlativo: string): FormState {
  return {
    nombre,
    correlativo,
    estado: "Ingresado",
    rows: [createDraftRow()],
  };
}

function toInputDateTime(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return match ? `${match[1]}T${match[2]}` : value.slice(0, 16);
}

function formatHistoryDateTime(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : value.slice(0, 16).replace("T", " ");
}

function compareCtSupervisoresRows(left: CtSupervisoresRow, right: CtSupervisoresRow) {
  if (left.CreadoEn !== right.CreadoEn) {
    return left.CreadoEn < right.CreadoEn ? 1 : -1;
  }

  return right.Id - left.Id;
}

async function readJsonOrText(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as ApiResponse;
  }
  return { error: await response.text() };
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className="h-4 w-4">
      <path
        d="M13.5 3.5l3 3-8.75 8.75L5 15l.75-2.75L13.5 3.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.75 5.25l3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className="h-4 w-4">
      <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className="h-4 w-4">
      <path
        d="M6 7.5h8m-6 0V6.25A1.25 1.25 0 0 1 9.25 5h1.5A1.25 1.25 0 0 1 12 6.25V7.5m-5.5 0 .5 7.25A1.25 1.25 0 0 0 8.25 16h3.5a1.25 1.25 0 0 0 1.25-1.25l.5-7.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className="h-4 w-4">
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CtSupervisoresManager({
  sessionName,
  sessionUser,
  sessionRole,
  initialRows,
  initialNextCorrelativo,
}: {
  sessionName: string;
  sessionUser: string;
  sessionRole: string;
  initialRows: CtSupervisoresRow[];
  initialNextCorrelativo: string;
}) {
  const [entries, setEntries] = useState(initialRows);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"registros" | "historial">("registros");
  const [nextCorrelativo, setNextCorrelativo] = useState(initialNextCorrelativo);
  const [form, setForm] = useState<FormState>(() => createEmptyForm(sessionName, initialNextCorrelativo));
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPrivilegedRole =
    sessionRole === "Administrador" || sessionRole === "RRHH" || sessionRole === "Gerencia";
  const isEditing = selectedId !== null;
  const selectedEntry = entries.find((entry) => entry.Id === selectedId) ?? null;
  const totalFormDays = form.rows.reduce((total, row) => total + Number(row.dias), 0);
  const estadoTone = getEstadoTone(form.estado);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      if (activeTab !== "historial" || !selectedId) {
        setHistoryRows([]);
        setHistoryError(null);
        setHistoryLoading(false);
        return;
      }

      setHistoryLoading(true);
      setHistoryError(null);

      try {
        const response = await fetch(`/api/asistencia/ct-supervisores/${selectedId}`, {
          cache: "no-store",
        });
        const payload = (await readJsonOrText(response)) as ApiResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "No fue posible cargar el historial.");
        }

        if (!cancelled) {
          setHistoryRows(payload.history ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setHistoryRows([]);
          setHistoryError(
            loadError instanceof Error ? loadError.message : "No fue posible cargar el historial.",
          );
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedId]);

  function formatTotalDays(total: number) {
    const rounded = Math.round(total * 100) / 100;
    return Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function resetForm() {
    setSelectedId(null);
    setActiveTab("registros");
    setForm(createEmptyForm(sessionName, nextCorrelativo));
    setError(null);
    setHistoryRows([]);
    setHistoryError(null);
  }

  function startCreate() {
    resetForm();
  }

  function canEditEntry(entry: CtSupervisoresRow) {
    if (isPrivilegedRole) {
      return true;
    }

    const isOwner =
      entry.CreadoPorUsuario === sessionUser ||
      entry.CreadoPorNombre === sessionName ||
      entry.Nombre === sessionName;

    return isOwner && entry.Estado === "Ingresado";
  }

  function canDeleteEntry(entry: CtSupervisoresRow) {
    return canEditEntry(entry);
  }

  function canChangeEntryState(entry: CtSupervisoresRow) {
    if (sessionRole === "Gerencia") {
      return entry.Estado !== "Ingresado a Vacaciones" && entry.Estado !== "Ingresado a Liquidación";
    }

    return isPrivilegedRole;
  }

  function startEdit(entry: CtSupervisoresRow) {
    if (!canEditEntry(entry)) {
      return;
    }

    setActiveTab("registros");

    const rows = entries
      .filter((current) => current.Correlativo === entry.Correlativo)
      .sort((left, right) => left.Id - right.Id);

    setSelectedId(entry.Id);
    setForm({
      nombre: entry.Nombre,
      correlativo: entry.Correlativo,
      estado: entry.Estado,
      rows:
        rows.length > 0
          ? rows.map((row) => ({
              key: `row-${row.Id}`,
              lugar: row.Lugar,
              entrada: toInputDateTime(row.Entrada),
              salida: toInputDateTime(row.Salida),
              dias: row.Dias === 0.25 ? "0.25" : "1",
            }))
          : [
              {
                key: `row-${entry.Id}`,
                lugar: entry.Lugar,
                entrada: toInputDateTime(entry.Entrada),
                salida: toInputDateTime(entry.Salida),
                dias: entry.Dias === 0.25 ? "0.25" : "1",
              },
            ],
    });
    setError(null);
  }

  function openHistory(entry: CtSupervisoresRow) {
    setSelectedId(entry.Id);
    setActiveTab("historial");
    setError(null);
  }

  function applyAffectedRows(correlativo: string, rows: CtSupervisoresRow[]) {
    setEntries((current) =>
      [...current.filter((entry) => entry.Correlativo !== correlativo), ...rows].sort(compareCtSupervisoresRows),
    );
  }

  function removeEntriesByCorrelativo(correlativo: string) {
    setEntries((current) => current.filter((entry) => entry.Correlativo !== correlativo));
  }

  async function refreshEntries() {
    const response = await fetch("/api/asistencia/ct-supervisores", {
      cache: "no-store",
    });
    const payload = (await readJsonOrText(response)) as ApiResponse;

    if (!response.ok) {
      throw new Error(payload.error ?? "No fue posible cargar los ingresos.");
    }

    setEntries(payload.rows ?? []);
    if (payload.nextCorrelativo) {
      setNextCorrelativo(payload.nextCorrelativo);
      return payload.nextCorrelativo;
    }

    return null;
  }

  async function handleDelete() {
    if (!selectedId || !selectedEntry || !canDeleteEntry(selectedEntry)) {
      return;
    }

    const confirmed = window.confirm(
      "¿Eliminar este formulario completo? Se borraran todas las lineas asociadas al correlativo.",
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/asistencia/ct-supervisores/${selectedId}`, {
        method: "DELETE",
      });

      const payload = (await readJsonOrText(response)) as ApiResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible eliminar el formulario.");
      }

      if (payload.deletedCorrelativo) {
        removeEntriesByCorrelativo(payload.deletedCorrelativo);
      } else {
        await refreshEntries();
      }

      const next = payload.nextCorrelativo ?? nextCorrelativo;
      if (payload.nextCorrelativo) {
        setNextCorrelativo(payload.nextCorrelativo);
      }

      setSelectedId(null);
      setActiveTab("registros");
      setForm(createEmptyForm(sessionName, next));
      setHistoryRows([]);
      setHistoryError(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "No fue posible eliminar el formulario.",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setForm((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    }));
  }

  function addRow() {
    setForm((current) => ({
      ...current,
      rows: [...current.rows, createDraftRow()],
    }));
  }

  function removeRow(key: string) {
    setForm((current) => {
      if (current.rows.length === 1) {
        return current;
      }

      return {
        ...current,
        rows: current.rows.filter((row) => row.key !== key),
      };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payloadRows = form.rows.map((row) => ({
        lugar: row.lugar.trim(),
        entrada: row.entrada.trim(),
        salida: row.salida.trim(),
        dias: Number(row.dias),
      }));

      const endpoint = isEditing
        ? `/api/asistencia/ct-supervisores/${selectedId}`
        : "/api/asistencia/ct-supervisores";
      const method = isEditing ? "PATCH" : "POST";

      const body = isEditing
        ? {
            estado: form.estado,
            rows: payloadRows,
          }
        : {
            correlativo: form.correlativo.trim(),
            estado: form.estado,
            nombre: form.nombre.trim(),
            rows: payloadRows,
          };

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = (await readJsonOrText(response)) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error ?? `No fue posible ${isEditing ? "actualizar" : "guardar"} el ingreso.`,
        );
      }

      const affectedCorrelativo = data.affectedRows?.[0]?.Correlativo ?? form.correlativo.trim();

      if (data.affectedRows && affectedCorrelativo) {
        applyAffectedRows(affectedCorrelativo, data.affectedRows);
      } else {
        await refreshEntries();
      }

      const next = data.nextCorrelativo ?? nextCorrelativo;
      if (data.nextCorrelativo) {
        setNextCorrelativo(data.nextCorrelativo);
      }

      setSelectedId(null);
      setActiveTab("registros");
      setForm(createEmptyForm(sessionName, next));
      setHistoryRows([]);
      setHistoryError(null);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "No fue posible guardar el ingreso.",
      );
    } finally {
      setSaving(false);
    }
  }

  const canChangeSelectedState = selectedEntry ? canChangeEntryState(selectedEntry) : true;

  function renderChangeValue(value: string | null) {
    if (!value) {
      return "Sin valor";
    }

    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(value)) {
      return formatHistoryDateTime(value);
    }

    return value ?? "Sin valor";
  }

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
      <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
              {isEditing ? "Editar ingreso" : "Nuevo ingreso CT"}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {isEditing ? "Editar formulario completo" : "Crear formulario"}
            </h3>
          </div>

          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving || !selectedEntry || !canDeleteEntry(selectedEntry)}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <TrashIcon />
                  Eliminar formulario
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <XIcon />
                  Cancelar
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
            >
              <PlusIcon />
              Nuevo Ingreso CT
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Nombre
              <input
                value={form.nombre}
                readOnly
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 outline-none"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Correlativo
              <input
                value={form.correlativo}
                readOnly
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 outline-none"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              <div className="flex items-center gap-2">
                <span>Estado</span>
                <span className={`inline-flex items-end gap-2 rounded-full border px-3 py-1.5 ${estadoTone.badge}`}>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                    Total dias
                  </span>
                  <span className={`text-2xl font-bold leading-none ${estadoTone.text}`}>
                    {formatTotalDays(totalFormDays)}
                  </span>
                </span>
              </div>
              <select
                value={form.estado}
                disabled={isEditing && !canChangeSelectedState}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    estado: event.target.value as CtSupervisoresEstado,
                  }))
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              >
                {CT_SUPERVISORES_ESTADOS.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-dashed border-slate-200 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Detalle
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Cada linea se guarda como un registro. Al editar se reemplaza todo el formulario con
                  el mismo correlativo.
                </p>
              </div>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={addRow}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <PlusIcon />
                  Agregar linea
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {form.rows.map((row, index) => (
                <div key={row.key} className="grid gap-3 xl:grid-cols-[1.3fr_1.1fr_1.1fr_110px_auto]">
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Lugar
                    <input
                      value={row.lugar}
                      onChange={(event) => updateRow(row.key, { lugar: event.target.value })}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                    />
                  </label>

                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Entrada
                    <input
                      type="datetime-local"
                      value={row.entrada}
                      onChange={(event) => updateRow(row.key, { entrada: event.target.value })}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                    />
                  </label>

                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Salida
                    <input
                      type="datetime-local"
                      value={row.salida}
                      onChange={(event) => updateRow(row.key, { salida: event.target.value })}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                    />
                  </label>

                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Dias
                    <select
                      value={row.dias}
                      onChange={(event) => updateRow(row.key, { dias: event.target.value as "0.25" | "1" })}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                    >
                      <option value="0.25">0.25</option>
                      <option value="1">1</option>
                    </select>
                  </label>

                  <div className="flex items-end gap-2">
                    <span className="pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Linea {index + 1}
                    </span>
                    {!isEditing && form.rows.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        className="ml-auto inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                      >
                        <TrashIcon />
                        Quitar
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {isEditing ? (
            <p className="text-xs text-slate-500">
              Estas editando el formulario completo asociado al correlativo {form.correlativo}.
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Limpiar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[#b45309] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#92400e] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando..." : isEditing ? "Actualizar formulario" : "Guardar ingreso"}
            </button>
          </div>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
              CT Supervisores
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Registros e historial
            </h3>
          </div>
          <button
            type="button"
            onClick={refreshEntries}
            className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Refrescar
          </button>
        </div>

        <div className="mt-6 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("registros")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === "registros"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Registros
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("historial");
              if (selectedId === null && entries.length > 0) {
                setSelectedId(entries[0].Id);
              }
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === "historial"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Control de cambios
          </button>
        </div>

        {activeTab === "registros" ? (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Correlativo</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Nombre</th>
                  <th className="px-3 py-3">Lugar</th>
                  <th className="px-3 py-3">Entrada</th>
                  <th className="px-3 py-3">Salida</th>
                  <th className="px-3 py-3">Dias</th>
                  <th className="px-3 py-3">Creado</th>
                  <th className="px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                      No hay registros aun.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.Id} className="align-top">
                      <td className="px-3 py-3 font-medium text-slate-900">{entry.Correlativo}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getEstadoTone(entry.Estado).badge}`}
                          >
                            {entry.Estado}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{entry.Nombre}</td>
                      <td className="px-3 py-3 text-slate-700">{entry.Lugar}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDateTimeDdMmYyyy(entry.Entrada)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDateTimeDdMmYyyy(entry.Salida)}</td>
                      <td className="px-3 py-3 text-slate-700">{entry.Dias}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDateTimeDdMmYyyy(entry.CreadoEn)}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openHistory(entry)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            Ver historial
                          </button>
                          <button
                            type="button"
                            onClick={() => startEdit(entry)}
                            disabled={!canEditEntry(entry)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <PencilIcon />
                            Editar formulario
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Control de cambios
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedEntry
                    ? `Historial del correlativo ${selectedEntry.Correlativo}.`
                    : "Selecciona un formulario para ver quien lo cambio, cuando y que campos toco."}
                </p>
              </div>
              {selectedEntry ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {historyRows.length} cambios
                </span>
              ) : null}
            </div>

            {!selectedEntry ? (
              <p className="mt-4 text-sm text-slate-500">
                Abre un formulario desde la pestaña de registros para ver su historial.
              </p>
            ) : historyLoading ? (
              <p className="mt-4 text-sm text-slate-500">Cargando historial...</p>
            ) : historyError ? (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {historyError}
              </p>
            ) : historyRows.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No hay cambios registrados para este formulario.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {historyRows.map((entry) => {
                  const changes = entry.Cambios?.changes ?? [];

                  return (
                    <div key={entry.Id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{entry.Accion}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {entry.EditadoPorNombre} · {entry.EditadoPorUsuario} · {entry.EditadoPorRol}
                        </p>
                      </div>
                      <p className="text-xs font-medium text-slate-500">
                        {formatHistoryDateTime(entry.EditadoEn)}
                      </p>
                    </div>

                      <div className="mt-3">
                        {changes.length === 0 ? (
                          <p className="text-sm text-slate-500">No se detectaron cambios detallados.</p>
                        ) : (
                          <ul className="space-y-2 text-sm text-slate-700">
                            {changes.map((change, index) => (
                              <li key={`${entry.Id}-${index}`} className="rounded-xl bg-slate-50 px-3 py-2">
                                <span className="font-semibold text-slate-900">
                                  Fila {change.row} - {change.field}:
                                </span>{" "}
                                {renderChangeValue(change.before)}{" "}
                                <span className="text-slate-400">-&gt;</span>{" "}
                                {renderChangeValue(change.after)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
