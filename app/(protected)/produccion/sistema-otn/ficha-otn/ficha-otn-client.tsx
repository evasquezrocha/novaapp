"use client";

import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { formatDateDdMmYyyy } from "@/lib/date-format";
import type {
  SalesCreditNoteResult,
  SalesInvoiceResult,
} from "@/lib/sap-stock";
import type { SistemaOtnAprobacionRow } from "@/lib/sistema-otn-aprobaciones-sql";
import type { SistemaOtnEntregaManualRow } from "@/lib/sistema-otn-entregas-manuales-sql";
import type { SistemaOtnRow } from "@/lib/sistema-otn-sql";
import { getSistemaOtnEstado } from "@/lib/sistema-otn-estado";
import { AprobacionesTabEditor } from "./aprobaciones-tab-editor";

type FichaOtnResponse = {
  otn: string;
  info: SistemaOtnRow | null;
  aprobaciones: SistemaOtnAprobacionRow[];
  entregas: {
    manuales: SistemaOtnEntregaManualRow[];
  };
  facturas: SalesInvoiceResult;
  notasCredito: SalesCreditNoteResult;
  error?: string;
};

type TabKey = "informacion" | "aprobaciones" | "entregas" | "facturas" | "notas";
type SalesInvoiceRow = FichaOtnResponse["facturas"]["rows"][number];
type SalesCreditNoteRow = FichaOtnResponse["notasCredito"]["rows"][number];
type InfoFormState = {
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

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "informacion", label: "Informacion" },
  { key: "aprobaciones", label: "Aprobaciones" },
  { key: "entregas", label: "Entregas" },
  { key: "facturas", label: "Facturas" },
  { key: "notas", label: "Notas de Credito" },
];

function currency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function number(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function inputClassName() {
  return "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-100";
}

function toInputValue(value: string | null | undefined) {
  return value ?? "";
}

function toNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildInfoFormState(info: SistemaOtnRow | null): InfoFormState {
  return {
    FechaIngreso: toInputValue(info?.FechaIngreso),
    Cliente: toInputValue(info?.Cliente),
    Empresa: toInputValue(info?.Empresa),
    Solicitante: toInputValue(info?.Solicitante),
    CC: toInputValue(info?.CC),
    Cantidad: info?.Cantidad === null || info?.Cantidad === undefined ? "" : String(info.Cantidad),
    Descripcion: toInputValue(info?.Descripcion),
    ReferenciaCliente: toInputValue(info?.ReferenciaCliente),
    Cotizador: toInputValue(info?.Cotizador),
    Equipo: toInputValue(info?.Equipo) || "Sí",
    FechaPpto: toInputValue(info?.FechaPpto),
    ValorPpto: info?.ValorPpto === null || info?.ValorPpto === undefined ? "" : String(info.ValorPpto),
    Plazo: toInputValue(info?.Plazo),
    Observaciones: toInputValue(info?.Observaciones),
    Ruta: toInputValue(info?.Ruta),
  };
}

function tabButtonClassName(active: boolean) {
  return [
    "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition",
    active
      ? "bg-orange-600 text-white"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  ].join(" ");
}

function panelClassName() {
  return "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600">
      {text}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-700">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

type EntregasTabProps = {
  otn: string;
  manualRows: SistemaOtnEntregaManualRow[];
  onChanged: () => Promise<void> | void;
};

function EntregasTab({
  otn,
  manualRows,
  onChanged,
}: EntregasTabProps) {
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [valorEntrega, setValorEntrega] = useState("");
  const [referenciaEntrega, setReferenciaEntrega] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manualTotal = useMemo(
    () => manualRows.reduce((sum, row) => sum + row.ValorEntrega, 0),
    [manualRows],
  );
  const selectedTotal = manualTotal;
  const sourceLabel = "Entregas manuales";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/produccion/sistema-otn/entregas-manuales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          OTN: otn,
          FechaEntrega: fechaEntrega.trim() || null,
          ValorEntrega: valorEntrega.trim() ? Number(valorEntrega) : null,
          ReferenciaEntrega: referenciaEntrega.trim() || null,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible guardar la entrega manual.");
      }

      setFechaEntrega("");
      setValorEntrega("");
      setReferenciaEntrega("");
      await onChanged();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible guardar la entrega manual.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    const confirmed = window.confirm("¿Eliminar la entrega manual?");
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/produccion/sistema-otn/entregas-manuales/${id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible eliminar la entrega manual.");
      }

      await onChanged();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No fue posible eliminar la entrega manual.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Cargar entrega manual
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Vista activa: {sourceLabel}.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-700">
              Fecha de entrega
            </label>
            <input
              type="date"
              required
              value={fechaEntrega}
              onChange={(event) => setFechaEntrega(event.target.value)}
              className={inputClassName()}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-700">
              Valor entrega
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={valorEntrega}
              onChange={(event) => setValorEntrega(event.target.value)}
              className={inputClassName()}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-slate-700">
              Referencia entrega
            </label>
            <input
              value={referenciaEntrega}
              onChange={(event) => setReferenciaEntrega(event.target.value)}
              className={inputClassName()}
            />
          </div>
          <div className="md:col-span-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center rounded-full bg-orange-600 px-4 text-xs font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Agregar entrega manual"}
            </button>
          </div>
        </form>
        {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <StatBox label="Fuente activa" value={sourceLabel} />
          <StatBox label="Total considerado" value={currency(selectedTotal)} />
          <StatBox label="Total registradas" value={currency(manualTotal)} />
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Entregas manuales
        </p>
        {manualRows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Fecha de entrega</th>
                  <th className="px-3 py-2">Referencia entrega</th>
                  <th className="px-3 py-2 text-right">Valor entrega</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {manualRows.map((row) => (
                  <tr key={row.Id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-700">
                      {formatDateDdMmYyyy(row.FechaEntrega)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.ReferenciaEntrega ?? "-"}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {currency(row.ValorEntrega)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(row.Id)}
                        disabled={saving}
                        className="rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState text="No hay entregas manuales registradas para esta OTN." />
        )}
      </div>
    </div>
  );
}

function FieldCell({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xs text-slate-900">
        {typeof value === "number" ? number(value) : value ?? "-"}
      </p>
    </div>
  );
}

export function FichaOtnClient() {
  const searchParams = useSearchParams();
  const initialOtn = searchParams.get("otn")?.trim() ?? "";
  const [otn, setOtn] = useState(initialOtn);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FichaOtnResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("informacion");
  const [openingRuta, setOpeningRuta] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState<Record<number, boolean>>({});
  const [infoEditing, setInfoEditing] = useState(false);
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [infoForm, setInfoForm] = useState<InfoFormState>(() => buildInfoFormState(null));

  async function fetchFicha(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Escribe una OTN para buscar.");
      throw new Error("Escribe una OTN para buscar.");
    }

    const response = await fetch(
      `/api/produccion/sistema-otn/ficha?otn=${encodeURIComponent(trimmed)}`,
      { cache: "no-store" },
    );
    const payload = (await response.json()) as FichaOtnResponse;

    if (!response.ok) {
      throw new Error(payload.error ?? "No fue posible consultar la ficha OTN.");
    }

    return payload;
  }

  async function loadOtn(value: string) {
    setLoading(true);
    setError(null);

    try {
      const payload = await fetchFicha(value);
      setData(payload);
      setExpandedInvoices({});
      setActiveTab("informacion");
    } catch (searchError) {
      setData(null);
      setExpandedInvoices({});
      setError(
        searchError instanceof Error
          ? searchError.message
          : "No fue posible consultar la ficha OTN.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialOtn) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/produccion/sistema-otn/ficha?otn=${encodeURIComponent(initialOtn)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as FichaOtnResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "No fue posible consultar la ficha OTN.");
        }

        if (!cancelled) {
          setData(payload);
          setExpandedInvoices({});
          setActiveTab("informacion");
        }
      } catch (searchError) {
        if (!cancelled) {
          setData(null);
          setExpandedInvoices({});
          setError(
            searchError instanceof Error
              ? searchError.message
              : "No fue posible consultar la ficha OTN.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialOtn]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadOtn(otn);
  }

  async function handleOpenRuta() {
    const ruta = data?.info?.Ruta?.trim();
    if (!ruta) {
      setError("Esta OTN no tiene ruta registrada.");
      return;
    }

    setOpeningRuta(true);
    setError(null);

    try {
      const response = await fetch("/api/produccion/sistema-otn/open-ruta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruta }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible abrir la ruta.");
      }
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "No fue posible abrir la ruta.");
    } finally {
      setOpeningRuta(false);
    }
  }

  const headerSummary = useMemo(() => {
    const info = data?.info;
    return {
      otn: data?.otn ?? otn.trim(),
      cliente: info?.Cliente ?? "-",
      descripcion: info?.Descripcion ?? "-",
    };
  }, [data, otn]);

  const info = data?.info ?? null;

  const aprobacionesTotal = useMemo(
    () => (data?.aprobaciones ?? []).reduce((sum, row) => sum + (row.ValorAprobado ?? 0), 0),
    [data],
  );

  const facturasRows = useMemo(() => data?.facturas.rows ?? [], [data]);
  const notasCreditoRows = useMemo(() => data?.notasCredito.rows ?? [], [data]);
  const entregasFuenteLabel = "Manuales";

  const resumenTotales = useMemo(() => {
    const totalPresupuesto = info?.ValorPpto ?? 0;
    const totalAprobado = aprobacionesTotal;
    const totalEntregadoManual = (data?.entregas.manuales ?? []).reduce(
      (sum, row) => sum + row.ValorEntrega,
      0,
    );
    const totalEntregado = totalEntregadoManual;
    const totalFacturado = facturasRows.reduce((sum, row) => sum + row.Total, 0);
    const totalNotasCredito = notasCreditoRows.reduce((sum, row) => sum + row.TotalNeto, 0);
    const totalFacturadoPendiente = facturasRows.reduce(
      (sum, row) => sum + (row.TotalPendiente ?? 0),
      0,
    );

    return {
      totalPresupuesto,
      totalAprobado,
      totalEntregado,
      totalFacturado,
      totalNotasCredito,
      totalFacturadoPendiente,
    };
  }, [aprobacionesTotal, data, facturasRows, info?.ValorPpto, notasCreditoRows]);

  const estadoOtn = useMemo(
    () => getSistemaOtnEstado(resumenTotales),
    [resumenTotales],
  );

  const infoLine1 = [
    ["OTN", info?.OTN],
    ["Estado", estadoOtn],
    ["Fecha Ingreso", info?.FechaIngreso ? formatDateDdMmYyyy(info.FechaIngreso) : "-"],
    ["Empresa", info?.Empresa],
    ["CC", info?.CC],
  ] as Array<[string, string | number | null | undefined]>;
  const infoLine2 = [
    ["Cliente", info?.Cliente],
    ["Descripcion", info?.Descripcion],
    ["Cantidad", info?.Cantidad],
  ] as Array<[string, string | number | null | undefined]>;
  const infoLine3 = [
    ["Solicitante", info?.Solicitante],
    ["Referencia Cliente", info?.ReferenciaCliente],
    ["Equipo", info?.Equipo],
  ] as Array<[string, string | number | null | undefined]>;

  async function refreshFicha() {
    try {
      const payload = await fetchFicha(data?.otn ?? otn);
      setData(payload);
      setExpandedInvoices({});
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "No fue posible consultar la ficha OTN.",
      );
    }
  }

  function startInfoEdit() {
    if (!info) {
      return;
    }

    setInfoForm(buildInfoFormState(info));
    setInfoError(null);
    setInfoEditing(true);
  }

  function cancelInfoEdit() {
    setInfoForm(buildInfoFormState(info));
    setInfoError(null);
    setInfoEditing(false);
  }

  async function handleInfoSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!info) {
      return;
    }

    setInfoSaving(true);
    setInfoError(null);

    try {
      const response = await fetch(`/api/produccion/sistema-otn/${info.Id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          FechaIngreso: infoForm.FechaIngreso.trim() || null,
          Cliente: infoForm.Cliente.trim() || null,
          Empresa: infoForm.Empresa.trim() || null,
          Solicitante: infoForm.Solicitante.trim() || null,
          CC: infoForm.CC.trim() || null,
          Cantidad: toNumberOrNull(infoForm.Cantidad),
          Descripcion: infoForm.Descripcion.trim() || null,
          ReferenciaCliente: infoForm.ReferenciaCliente.trim() || null,
          Cotizador: infoForm.Cotizador.trim() || null,
          Equipo: infoForm.Equipo.trim() || null,
          FechaPpto: infoForm.FechaPpto.trim() || null,
          ValorPpto: toNumberOrNull(infoForm.ValorPpto),
          Plazo: infoForm.Plazo.trim() || null,
          Observaciones: infoForm.Observaciones.trim() || null,
          Ruta: infoForm.Ruta.trim() || null,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; row?: SistemaOtnRow; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible actualizar la información.");
      }

      setInfoEditing(false);
      await loadOtn(info.OTN);
    } catch (saveError) {
      setInfoError(
        saveError instanceof Error ? saveError.message : "No fue posible actualizar la información.",
      );
    } finally {
      setInfoSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-stretch">
        <form className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-700">OTN</label>
              <input
                value={otn}
                onChange={(event) => setOtn(event.target.value)}
                className={inputClassName()}
                placeholder="OTN"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-9 items-center rounded-full bg-orange-600 px-4 text-xs font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.55)]">
          <div className="border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-5 py-5 text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-100">
                  Resumen
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="text-3xl font-semibold tracking-tight text-white">
                    {headerSummary.otn || "-"}
                  </div>
                  {estadoOtn ? (
                    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-cyan-100">
                      {estadoOtn}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-slate-100">
                    Entregas: {entregasFuenteLabel}
                  </span>
                </div>
                <div className="mt-1 text-base font-medium text-slate-200">
                  {headerSummary.cliente}
                </div>
                <div className="mt-1 max-w-xl text-sm leading-6 text-slate-300">
                  {headerSummary.descripcion}
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenRuta}
                disabled={openingRuta || !data?.info?.Ruta?.trim()}
                className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {openingRuta ? "Abriendo..." : "Abrir Carpeta"}
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <StatBox label="Total Presupuesto" value={currency(resumenTotales.totalPresupuesto)} />
              <StatBox label="Total Aprobado" value={currency(resumenTotales.totalAprobado)} />
              <StatBox label="Total Entregado" value={currency(resumenTotales.totalEntregado)} />
              <StatBox label="Total Facturado" value={currency(resumenTotales.totalFacturado)} />
              <StatBox
                label="Total Notas de Crédito"
                value={currency(resumenTotales.totalNotasCredito)}
              />
              <StatBox
                label="Total Facturado Pendiente"
                value={currency(resumenTotales.totalFacturadoPendiente)}
              />
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {data ? (
        <div className="grid gap-4">
          <div className={panelClassName()}>
            <div className="mb-3 flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={tabButtonClassName(activeTab === tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "informacion" ? (
              data.info ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <button
                      type="button"
                      onClick={infoEditing ? cancelInfoEdit : startInfoEdit}
                      className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      {infoEditing ? "Cancelar edición" : "Editar información"}
                    </button>
                  </div>

                  {infoError ? (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {infoError}
                    </p>
                  ) : null}

                  {infoEditing ? (
                    <form
                      onSubmit={handleInfoSave}
                      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-700">
                            Fecha ingreso
                          </label>
                          <input
                            type="date"
                            value={infoForm.FechaIngreso}
                            onChange={(event) =>
                              setInfoForm((current) => ({
                                ...current,
                                FechaIngreso: event.target.value,
                              }))
                            }
                            className={inputClassName()}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-700">
                            Empresa
                          </label>
                          <input
                            value={infoForm.Empresa}
                            onChange={(event) =>
                              setInfoForm((current) => ({ ...current, Empresa: event.target.value }))
                            }
                            className={inputClassName()}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-700">
                            CC
                          </label>
                          <input
                            value={infoForm.CC}
                            onChange={(event) =>
                              setInfoForm((current) => ({ ...current, CC: event.target.value }))
                            }
                            className={inputClassName()}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-700">
                            Cliente
                          </label>
                          <input
                            value={infoForm.Cliente}
                            onChange={(event) =>
                              setInfoForm((current) => ({
                                ...current,
                                Cliente: event.target.value,
                              }))
                            }
                            className={inputClassName()}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-700">
                            Solicitante
                          </label>
                          <input
                            value={infoForm.Solicitante}
                            onChange={(event) =>
                              setInfoForm((current) => ({
                                ...current,
                                Solicitante: event.target.value,
                              }))
                            }
                            className={inputClassName()}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-700">
                            Cantidad
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={infoForm.Cantidad}
                            onChange={(event) =>
                              setInfoForm((current) => ({
                                ...current,
                                Cantidad: event.target.value,
                              }))
                            }
                            className={inputClassName()}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-[11px] font-medium text-slate-700">
                            Descripción
                          </label>
                          <textarea
                            rows={3}
                            value={infoForm.Descripcion}
                            onChange={(event) =>
                              setInfoForm((current) => ({
                                ...current,
                                Descripcion: event.target.value,
                              }))
                            }
                            className={inputClassName()}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-700">
                            Referencia cliente
                          </label>
                          <input
                            value={infoForm.ReferenciaCliente}
                            onChange={(event) =>
                              setInfoForm((current) => ({
                                ...current,
                                ReferenciaCliente: event.target.value,
                              }))
                            }
                            className={inputClassName()}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-700">
                            Cotizador
                          </label>
                          <input
                            value={infoForm.Cotizador}
                            onChange={(event) =>
                              setInfoForm((current) => ({
                                ...current,
                                Cotizador: event.target.value,
                              }))
                            }
                            className={inputClassName()}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-700">
                            Equipo
                          </label>
                          <select
                            value={infoForm.Equipo}
                            onChange={(event) =>
                              setInfoForm((current) => ({
                                ...current,
                                Equipo: event.target.value,
                              }))
                            }
                            className={inputClassName()}
                          >
                            <option value="Sí">Sí</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-700">
                            Fecha presupuesto
                          </label>
                          <input
                            type="date"
                            value={infoForm.FechaPpto}
                            onChange={(event) =>
                              setInfoForm((current) => ({
                                ...current,
                                FechaPpto: event.target.value,
                              }))
                            }
                            className={inputClassName()}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-700">
                            Valor presupuesto
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={infoForm.ValorPpto}
                            onChange={(event) =>
                              setInfoForm((current) => ({
                                ...current,
                                ValorPpto: event.target.value,
                              }))
                            }
                            className={inputClassName()}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-700">
                            Plazo
                          </label>
                          <input
                            value={infoForm.Plazo}
                            onChange={(event) =>
                              setInfoForm((current) => ({ ...current, Plazo: event.target.value }))
                            }
                            className={inputClassName()}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-700">
                            Ruta
                          </label>
                          <input
                            value={infoForm.Ruta}
                            onChange={(event) =>
                              setInfoForm((current) => ({ ...current, Ruta: event.target.value }))
                            }
                            className={inputClassName()}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-700">
                          Observaciones
                        </label>
                        <textarea
                          rows={4}
                          value={infoForm.Observaciones}
                          onChange={(event) =>
                            setInfoForm((current) => ({
                              ...current,
                              Observaciones: event.target.value,
                            }))
                          }
                          className={inputClassName()}
                        />
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="submit"
                          disabled={infoSaving}
                          className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {infoSaving ? "Guardando..." : "Guardar cambios"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelInfoEdit}
                          disabled={infoSaving}
                          className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid gap-2 md:grid-cols-5">
                        {infoLine1.map(([label, value]) => (
                          <FieldCell key={label} label={label} value={value} />
                        ))}
                      </div>

                      <div className="grid gap-2 md:grid-cols-3">
                        {infoLine2.map(([label, value]) => (
                          <FieldCell key={label} label={label} value={value} />
                        ))}
                      </div>

                      <div className="grid gap-2 md:grid-cols-3">
                        {infoLine3.map(([label, value]) => (
                          <FieldCell key={label} label={label} value={value} />
                        ))}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Presupuesto Cliente
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          <StatBox label="Cotizador" value={info?.Cotizador ?? "-"} />
                          <StatBox
                            label="Fecha Presupuesto"
                            value={info?.FechaPpto ? formatDateDdMmYyyy(info.FechaPpto) : "-"}
                          />
                          <StatBox
                            label="Valor Presupuesto"
                            value={currency(info?.ValorPpto ?? null)}
                          />
                          <StatBox label="Plazo" value={info?.Plazo ?? "-"} />
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Observaciones
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-900">
                          {info?.Observaciones ?? "-"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState text="No existe en Sistema OTN." />
              )
            ) : null}

            {activeTab === "aprobaciones" ? (
              <AprobacionesTabEditor
                key={data?.otn ?? otn.trim()}
                otn={data?.otn ?? otn.trim()}
                initialRows={data?.aprobaciones ?? []}
                onChanged={refreshFicha}
              />
            ) : null}

            {activeTab === "entregas" ? (
                <EntregasTab
                  key={`${info?.Id ?? 0}`}
                  otn={data?.otn ?? otn}
                manualRows={data?.entregas.manuales ?? []}
                onChanged={refreshFicha}
              />
            ) : null}

            {activeTab === "facturas" ? (
              <FacturasTab
                rows={facturasRows}
                expandedInvoices={expandedInvoices}
                onToggle={(docEntry) =>
                  setExpandedInvoices((current) => ({
                    ...current,
                    [docEntry]: !current[docEntry],
                  }))
                }
              />
            ) : null}

            {activeTab === "notas" ? <NotasCreditoTab rows={notasCreditoRows} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FacturasTab({
  rows,
  expandedInvoices,
  onToggle,
}: {
  rows: SalesInvoiceRow[];
  expandedInvoices: Record<number, boolean>;
  onToggle: (docEntry: number) => void;
}) {
  const columns = [
    { key: "NumeroFV", label: "N° FV SAP" },
    { key: "FolioNum", label: "N° Folio" },
    { key: "Fecha", label: "Fecha" },
    { key: "FechaVencimiento", label: "Fecha de Vencimiento" },
    { key: "Total", label: "Total", alignRight: true },
    { key: "TotalPendiente", label: "Total Pendiente", alignRight: true },
  ] as const;

  if (!rows.length) {
    return <EmptyState text="No hay facturas de venta registradas para esta OTN." />;
  }

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.2em] text-slate-500">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 py-2 ${"alignRight" in column && column.alignRight ? "text-right" : ""}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const expanded = expandedInvoices[row.DocEntry] ?? false;

              return (
                <Fragment key={row.DocEntry}>
                  <tr
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => onToggle(row.DocEntry)}
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{expanded ? "-" : "+"}</span>
                        <span>{row.NumeroFV}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.FolioNum ?? "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{formatDateDdMmYyyy(row.Fecha)}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {formatDateDdMmYyyy(row.FechaVencimiento)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {currency(row.Total)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {currency(row.TotalPendiente)}
                    </td>
                  </tr>

                  {expanded ? (
                    <tr>
                      <td colSpan={6} className="bg-slate-50 px-3 py-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Lineas de factura
                          </p>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                              <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                                <tr>
                                  <th className="px-3 py-2">Descripcion de la Linea</th>
                                  <th className="px-3 py-2 text-right">Cantidad</th>
                                  <th className="px-3 py-2 text-right">Precio Unitario</th>
                                  <th className="px-3 py-2 text-right">Valor Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {row.lineas.map((linea) => (
                                  <tr key={`${row.DocEntry}-${linea.LineNum}`}>
                                    <td className="px-3 py-2 text-slate-700">
                                      {linea.DescripcionLinea || "-"}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-700">
                                      {number(linea.Cantidad)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-700">
                                      {currency(linea.PrecioUnitario)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-700">
                                      {currency(linea.ValorTotal)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotasCreditoTab({ rows }: { rows: SalesCreditNoteRow[] }) {
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const columns = [
    { key: "NumeroNC", label: "N° NC" },
    { key: "Fecha", label: "Fecha" },
    { key: "TotalNeto", label: "Total Neto", alignRight: true },
    { key: "FacturaRef", label: "Factura Ref." },
  ] as const;

  if (!rows.length) {
    return <EmptyState text="No hay notas de credito registradas para esta OTN." />;
  }

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.2em] text-slate-500">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 py-2 ${"alignRight" in column && column.alignRight ? "text-right" : ""}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const expanded = expandedRows[row.DocEntry] ?? false;

              return (
                <Fragment key={row.DocEntry}>
                  <tr
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() =>
                      setExpandedRows((current) => ({
                        ...current,
                        [row.DocEntry]: !current[row.DocEntry],
                      }))
                    }
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{expanded ? "-" : "+"}</span>
                        <span>{row.NumeroNC}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{formatDateDdMmYyyy(row.Fecha)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{currency(row.TotalNeto)}</td>
                    <td className="px-3 py-2 text-slate-700">{row.FacturaRef || "-"}</td>
                  </tr>

                  {expanded ? (
                    <tr>
                      <td colSpan={4} className="bg-slate-50 px-3 py-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Lineas de nota de credito
                          </p>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                              <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                                <tr>
                                  <th className="px-3 py-2">Descripcion de la Linea</th>
                                  <th className="px-3 py-2 text-right">Cantidad</th>
                                  <th className="px-3 py-2 text-right">Precio Unitario</th>
                                  <th className="px-3 py-2 text-right">Valor Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {row.lineas.map((linea) => (
                                  <tr key={`${row.DocEntry}-${linea.LineNum}`}>
                                    <td className="px-3 py-2 text-slate-700">
                                      {linea.DescripcionLinea || "-"}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-700">
                                      {number(linea.Cantidad)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-700">
                                      {currency(linea.PrecioUnitario)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-700">
                                      {currency(linea.ValorTotal)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
