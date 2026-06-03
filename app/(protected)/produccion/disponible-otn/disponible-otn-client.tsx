"use client";

import type { FormEvent } from "react";
import { useState } from "react";

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
  rows: {
    Documento: number;
    Fecha: string;
    Proveedor: string;
    Descripcion: string;
    TotalLinea: number;
  }[];
};

type ServiciosUtilizados = {
  total: number;
  rows: {
    Documento: number;
    Fecha: string;
    Proveedor: string;
    Descripcion: string;
    TotalLinea: number;
  }[];
};

type NcServicios = {
  total: number;
  rows: {
    Documento: number;
    Fecha: string;
    Proveedor: string;
    Descripcion: string;
    TotalLinea: number;
  }[];
};

type TabKey =
  | "materiales-utilizados"
  | "materiales-devueltos"
  | "servicios-sin-oc"
  | "servicios-utilizados"
  | "nc-servicios";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "materiales-utilizados", label: "Materiales Utilizados" },
  { key: "materiales-devueltos", label: "Materiales Devueltos" },
  { key: "servicios-sin-oc", label: "Servicios Utilizados sin OC" },
  { key: "servicios-utilizados", label: "Servicios Utilizados" },
  { key: "nc-servicios", label: "NC Servicios" },
];

function formatAmount(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `$${new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value)}`;
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

export function DisponibleOtnClient() {
  const [otn, setOtn] = useState("");
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
  const [activeTab, setActiveTab] = useState<TabKey>("materiales-utilizados");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRow(null);
    setMateriales(null);
    setMaterialesDevueltos(null);
    setServiciosSinOc(null);
    setServiciosUtilizados(null);
    setNcServicios(null);

    if (!/^\d{6}$/.test(otn)) {
      setError("El OTN debe contener exactamente 6 dígitos.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/produccion/disponible-otn?otn=${encodeURIComponent(otn)}`,
      );
      const data = (await response.json()) as
        | {
            row: ProjectRow;
            materiales: MaterialesUtilizados;
            materialesDevueltos: MaterialesDevueltos;
            serviciosSinOc: ServiciosSinOc;
            serviciosUtilizados: ServiciosUtilizados;
            ncServicios: NcServicios;
          }
        | { error: string };

      if (!response.ok) {
        setError("error" in data ? data.error : "No fue posible consultar el OTN.");
        return;
      }

      setRow(data.row);
      setMateriales(data.materiales);
      setMaterialesDevueltos(data.materialesDevueltos);
      setServiciosSinOc(data.serviciosSinOc);
      setServiciosUtilizados(data.serviciosUtilizados);
      setNcServicios(data.ncServicios);
      setActiveTab("materiales-utilizados");
    } catch {
      setError("No fue posible consultar el OTN.");
    } finally {
      setLoading(false);
    }
  }

  const activeLabel =
    TABS.find((tab) => tab.key === activeTab)?.label ?? "Sección";
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
                  pattern="\d{6}"
                  placeholder="000000"
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
                    Descripción del proyecto
                  </p>
                  <p className="mt-3 text-lg font-semibold text-slate-950">
                    {row.DESCRIPCION || "-"}
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
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-cyan-950">
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
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-cyan-950">
                    {formatAmount(disponibleServicios)}
                  </p>
                </article>
              </div>
            ) : (
              <div className="flex w-full items-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Los resultados aparecerán aquí junto al botón de consulta.
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
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(materiales.total)}
                  </p>
                </div>

                <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Documento</th>
                        <th className="px-4 py-3 font-semibold">Fecha</th>
                        <th className="px-4 py-3 font-semibold">Código</th>
                        <th className="px-4 py-3 font-semibold">Descripción</th>
                        <th className="px-4 py-3 font-semibold text-right">Cantidad</th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Precio unitario
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {materiales.rows.length === 0 ? (
                        <tr>
                          <td
                            className="px-4 py-6 text-slate-500"
                            colSpan={7}
                          >
                            No hay materiales utilizados para este OTN.
                          </td>
                        </tr>
                      ) : (
                        materiales.rows.map((detail, index) => (
                          <tr key={`${detail.Documento}-${detail.Codigo}-${index}`}>
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {detail.Documento}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {formatDate(detail.Fecha)}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {detail.Codigo}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {detail.Descripcion}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                              {new Intl.NumberFormat("es-CL", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(detail.Cantidad)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                              {formatAmount(detail.PrecioUnitario)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-950">
                              {formatAmount(detail.TotalLinea)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
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
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(materialesDevueltos.total)}
                  </p>
                </div>

                <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Documento</th>
                        <th className="px-4 py-3 font-semibold">Fecha</th>
                        <th className="px-4 py-3 font-semibold">Código</th>
                        <th className="px-4 py-3 font-semibold">Descripción</th>
                        <th className="px-4 py-3 font-semibold text-right">Cantidad</th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Precio unitario
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {materialesDevueltos.rows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-slate-500" colSpan={7}>
                            No hay materiales devueltos para este OTN.
                          </td>
                        </tr>
                      ) : (
                        materialesDevueltos.rows.map((detail, index) => (
                          <tr key={`${detail.Documento}-${detail.Codigo}-${index}`}>
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {detail.Documento}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {formatDate(detail.Fecha)}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {detail.Codigo}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {detail.Descripcion}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                              {new Intl.NumberFormat("es-CL", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(detail.Cantidad)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                              {formatAmount(detail.PrecioUnitario)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-950">
                              {formatAmount(detail.TotalLinea)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
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
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(serviciosSinOc.total)}
                  </p>
                </div>

                <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Documento</th>
                        <th className="px-4 py-3 font-semibold">Fecha</th>
                        <th className="px-4 py-3 font-semibold">Proveedor</th>
                        <th className="px-4 py-3 font-semibold">Descripción</th>
                        <th className="px-4 py-3 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {serviciosSinOc.rows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-slate-500" colSpan={5}>
                            No hay servicios utilizados sin OC para este OTN.
                          </td>
                        </tr>
                      ) : (
                        serviciosSinOc.rows.map((detail, index) => (
                          <tr key={`${detail.Documento}-${detail.Descripcion}-${index}`}>
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {detail.Documento}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {formatDate(detail.Fecha)}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {detail.Proveedor}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {detail.Descripcion}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-950">
                              {formatAmount(detail.TotalLinea)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
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
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(serviciosUtilizados.total)}
                  </p>
                </div>

                <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Documento</th>
                        <th className="px-4 py-3 font-semibold">Fecha</th>
                        <th className="px-4 py-3 font-semibold">Proveedor</th>
                        <th className="px-4 py-3 font-semibold">Descripción</th>
                        <th className="px-4 py-3 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {serviciosUtilizados.rows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-slate-500" colSpan={5}>
                            No hay servicios utilizados para este OTN.
                          </td>
                        </tr>
                      ) : (
                        serviciosUtilizados.rows.map((detail, index) => (
                          <tr key={`${detail.Documento}-${detail.Descripcion}-${index}`}>
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {detail.Documento}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {formatDate(detail.Fecha)}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {detail.Proveedor}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {detail.Descripcion}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-950">
                              {formatAmount(detail.TotalLinea)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
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
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(ncServicios.total)}
                  </p>
                </div>

                <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Documento</th>
                        <th className="px-4 py-3 font-semibold">Fecha</th>
                        <th className="px-4 py-3 font-semibold">Proveedor</th>
                        <th className="px-4 py-3 font-semibold">Descripción</th>
                        <th className="px-4 py-3 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ncServicios.rows.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-slate-500" colSpan={5}>
                            No hay NC servicios para este OTN.
                          </td>
                        </tr>
                      ) : (
                        ncServicios.rows.map((detail, index) => (
                          <tr key={`${detail.Documento}-${detail.Descripcion}-${index}`}>
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {detail.Documento}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {formatDate(detail.Fecha)}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {detail.Proveedor}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {detail.Descripcion}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-950">
                              {formatAmount(detail.TotalLinea)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                Consulta un OTN para mostrar el total y el detalle de NC servicios.
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
              La sección <span className="font-medium text-slate-950">{activeLabel}</span> queda lista para cargar su consulta específica.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
