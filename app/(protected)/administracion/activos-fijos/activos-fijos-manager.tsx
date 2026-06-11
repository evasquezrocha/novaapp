"use client";

import { useMemo, useState } from "react";
import { formatDateDdMmYyyy } from "@/lib/date-format";
import type {
  ActivoFijoCatalogos,
  ActivoFijoRow,
  CatalogRow,
  CatalogKey,
} from "@/lib/activos-fijos-sql";

type CatalogDrafts = Record<CatalogKey, string>;

type CatalogEditState = {
  category: CatalogKey;
  id: number;
  nombre: string;
} | null;

type FormState = {
  AF: string;
  OC: string;
  Descripcion: string;
  TipoActivoId: string;
  MarcaId: string;
  Modelo: string;
  SeriePatente: string;
  NumeroFactura: string;
  FechaFactura: string;
  Valor: string;
  PropioLeasing: string;
  TotalmenteDepreciado: boolean;
  Observacion: string;
  GrupoContableId: string;
};

type SortKey =
  | "AF"
  | "OC"
  | "Descripcion"
  | "TipoActivo"
  | "Marca"
  | "Modelo"
  | "SeriePatente"
  | "Observacion"
  | "NumeroFactura"
  | "FechaFactura"
  | "Valor"
  | "PropioLeasing"
  | "TotalmenteDepreciado"
  | "Anio"
  | "GrupoContable";

type SortDirection = "asc" | "desc";

const INITIAL_FORM: FormState = {
  AF: "",
  OC: "",
  Descripcion: "",
  TipoActivoId: "",
  MarcaId: "",
  Modelo: "",
  SeriePatente: "",
  NumeroFactura: "",
  FechaFactura: "",
  Valor: "",
  PropioLeasing: "",
  TotalmenteDepreciado: false,
  Observacion: "",
  GrupoContableId: "",
};

const INITIAL_CATALOG_DRAFTS: CatalogDrafts = {
  tipo: "",
  marca: "",
  grupoContable: "",
};

function formatNullable(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function formatBoolean(value: boolean | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return value ? "Sí" : "No";
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

function isValidPositiveInteger(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildCatalogLabel(category: CatalogKey) {
  if (category === "grupoContable") {
    return "Grupo contable";
  }

  return category === "tipo" ? "Tipo de activo" : "Marca";
}

function getCatalogRows(catalogos: ActivoFijoCatalogos, category: CatalogKey) {
  if (category === "tipo") {
    return catalogos.tipos;
  }

  if (category === "marca") {
    return catalogos.marcas;
  }

  return catalogos.gruposContables;
}

function catalogRoute(category: CatalogKey) {
  return `/api/administracion/activos-fijos/catalogos/${category}`;
}

function compareValues(left: string | number | null, right: string | number | null) {
  if (left === right) {
    return 0;
  }

  if (left === null || left === undefined || left === "") {
    return 1;
  }

  if (right === null || right === undefined || right === "") {
    return -1;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }

  return String(left).localeCompare(String(right), "es", {
    numeric: true,
    sensitivity: "base",
  });
}

export function ActivosFijosManager({
  initialActivos,
  initialCatalogos,
}: {
  initialActivos: ActivoFijoRow[];
  initialCatalogos: ActivoFijoCatalogos;
}) {
  const [activos, setActivos] = useState(initialActivos);
  const [catalogos, setCatalogos] = useState(initialCatalogos);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [catalogDrafts, setCatalogDrafts] = useState<CatalogDrafts>(INITIAL_CATALOG_DRAFTS);
  const [showForm, setShowForm] = useState(false);
  const [showCatalogs, setShowCatalogs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState<CatalogKey | null>(null);
  const [catalogEdit, setCatalogEdit] = useState<CatalogEditState>(null);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [marcaFilter, setMarcaFilter] = useState("");
  const [grupoFilter, setGrupoFilter] = useState("");
  const [anioFilter, setAnioFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("AF");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const selectedActivo = useMemo(
    () => activos.find((row) => row.Id === selectedId) ?? null,
    [activos, selectedId],
  );
  const showSidePanels = showForm || showCatalogs;

  const filteredActivos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const normalizedAnio = anioFilter.trim();

    const rows = activos.filter((row) => {
      if (tipoFilter && String(row.TipoActivoId ?? "") !== tipoFilter) {
        return false;
      }

      if (marcaFilter && String(row.MarcaId ?? "") !== marcaFilter) {
        return false;
      }

      if (grupoFilter && String(row.GrupoContableId ?? "") !== grupoFilter) {
        return false;
      }

      if (normalizedAnio && String(row.Anio ?? "") !== normalizedAnio) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        row.AF,
        row.OC,
        row.Descripcion,
        row.TipoActivo,
        row.Marca,
        row.Modelo,
        row.SeriePatente,
        row.NumeroFactura,
        row.FechaFactura,
        row.Valor?.toString(),
        row.PropioLeasing,
        row.TotalmenteDepreciado ? "Sí" : "No",
        row.Observacion,
        row.GrupoContable,
        row.Anio?.toString(),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    const directionFactor = sortDirection === "asc" ? 1 : -1;

    return rows.sort((left, right) => {
      const leftValue =
        sortKey === "Anio"
          ? left.Anio
          : left[sortKey as keyof ActivoFijoRow];
      const rightValue =
        sortKey === "Anio"
          ? right.Anio
          : right[sortKey as keyof ActivoFijoRow];

      return compareValues(
        leftValue as string | number | null,
        rightValue as string | number | null,
      ) * directionFactor;
    });
  }, [activos, anioFilter, grupoFilter, marcaFilter, searchTerm, sortDirection, sortKey, tipoFilter]);

  function toggleSort(key: SortKey) {
    setSortKey((currentKey) => {
      if (currentKey === key) {
        setSortDirection((currentDirection) =>
          currentDirection === "asc" ? "desc" : "asc",
        );
        return currentKey;
      }

      setSortDirection("asc");
      return key;
    });
  }

  function resetFilters() {
    setSearchTerm("");
    setTipoFilter("");
    setMarcaFilter("");
    setGrupoFilter("");
    setAnioFilter("");
    setSortKey("AF");
    setSortDirection("asc");
  }

  function sortLabel(label: string, key: SortKey) {
    const active = sortKey === key;

    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-950"
      >
        <span>{label}</span>
        <span aria-hidden className="text-xs text-slate-400">
          {active ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
  }

  function resetForm() {
    setSelectedId(null);
    setForm(INITIAL_FORM);
    setError(null);
    setShowForm(false);
  }

  function openNewForm() {
    setSelectedId(null);
    setForm(INITIAL_FORM);
    setError(null);
    setShowForm(true);
  }

  function startEditCatalog(category: CatalogKey, row: CatalogRow) {
    setShowCatalogs(true);
    setCatalogError(null);
    setCatalogEdit({
      category,
      id: row.Id,
      nombre: row.Nombre,
    });
  }

  function cancelEditCatalog() {
    setCatalogEdit(null);
  }

  function startEdit(row: ActivoFijoRow) {
    setSelectedId(row.Id);
    setShowForm(true);
    setForm({
      AF: row.AF,
      OC: row.OC ?? "",
      Descripcion: row.Descripcion,
      TipoActivoId: row.TipoActivoId ? String(row.TipoActivoId) : "",
      MarcaId: row.MarcaId ? String(row.MarcaId) : "",
      Modelo: row.Modelo ?? "",
      SeriePatente: row.SeriePatente ?? "",
      NumeroFactura: row.NumeroFactura ?? "",
      FechaFactura: row.FechaFactura ?? "",
      Valor: row.Valor === null || row.Valor === undefined ? "" : String(row.Valor),
      PropioLeasing: row.PropioLeasing ?? "",
      TotalmenteDepreciado: row.TotalmenteDepreciado ?? false,
      Observacion: row.Observacion ?? "",
      GrupoContableId: row.GrupoContableId ? String(row.GrupoContableId) : "",
    });
    setError(null);
  }

  async function refreshData() {
    const response = await fetch("/api/administracion/activos-fijos", {
      cache: "no-store",
    });

    const payload = (await response.json()) as {
      activos?: ActivoFijoRow[];
      catalogos?: ActivoFijoCatalogos;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(
        payload.error ?? `No fue posible cargar activos fijos (${response.status}).`,
      );
    }

    setActivos(payload.activos ?? []);
    setCatalogos(
      payload.catalogos ?? {
        tipos: [],
        marcas: [],
        gruposContables: [],
      },
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        AF: form.AF.trim(),
        OC: form.OC.trim() || null,
        Descripcion: form.Descripcion.trim(),
        TipoActivoId: isValidPositiveInteger(form.TipoActivoId),
        MarcaId: isValidPositiveInteger(form.MarcaId),
        Modelo: form.Modelo.trim() || null,
        SeriePatente: form.SeriePatente.trim() || null,
        NumeroFactura: form.NumeroFactura.trim() || null,
        FechaFactura: form.FechaFactura.trim() || null,
        Valor: form.Valor.trim() ? Number(form.Valor) : null,
        PropioLeasing: form.PropioLeasing.trim() || null,
        TotalmenteDepreciado: form.TotalmenteDepreciado,
        Observacion: form.Observacion.trim() || null,
        GrupoContableId: isValidPositiveInteger(form.GrupoContableId),
      };

      const response = await fetch(
        selectedId ? `/api/administracion/activos-fijos/${selectedId}` : "/api/administracion/activos-fijos",
        {
          method: selectedId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(
          data.error ?? `No fue posible ${selectedId ? "actualizar" : "crear"} el activo fijo.`,
        );
      }

      await refreshData();
      resetForm();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "No fue posible guardar el activo fijo.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCatalog(category: CatalogKey) {
    const nombre = catalogDrafts[category].trim();
    if (!nombre) {
      return;
    }

    setCatalogSaving(category);
    setCatalogError(null);

    try {
      const response = await fetch(catalogRoute(category), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "create", nombre }),
      });

      const data = (await response.json()) as {
        error?: string;
        row?: CatalogRow;
      };

      if (!response.ok) {
        throw new Error(data.error ?? `No fue posible crear ${buildCatalogLabel(category).toLowerCase()}.`);
      }

      await refreshData();
      setCatalogDrafts((current) => ({ ...current, [category]: "" }));

      if (data.row) {
        setForm((current) => ({
          ...current,
          ...(category === "tipo"
            ? { TipoActivoId: String(data.row?.Id) }
            : category === "marca"
              ? { MarcaId: String(data.row?.Id) }
              : { GrupoContableId: String(data.row?.Id) }),
        }));
      }
    } catch (creationError) {
      setCatalogError(
        creationError instanceof Error
          ? creationError.message
          : "No fue posible agregar el catálogo.",
      );
    } finally {
      setCatalogSaving(null);
    }
  }

  async function handleUpdateCatalog() {
    if (!catalogEdit) {
      return;
    }

    const nombre = catalogEdit.nombre.trim();
    if (!nombre) {
      return;
    }

    setCatalogSaving(catalogEdit.category);
    setCatalogError(null);

    try {
      const response = await fetch(catalogRoute(catalogEdit.category), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update",
          id: catalogEdit.id,
          nombre,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        row?: CatalogRow;
      };

      if (!response.ok) {
        throw new Error(
          data.error ?? `No fue posible actualizar ${buildCatalogLabel(catalogEdit.category).toLowerCase()}.`,
        );
      }

      if (data.row) {
        setCatalogos((current) => ({
          ...current,
          ...(catalogEdit.category === "tipo"
            ? {
                tipos: current.tipos.map((row) =>
                  row.Id === data.row?.Id ? { ...row, Nombre: data.row.Nombre } : row,
                ),
              }
            : catalogEdit.category === "marca"
              ? {
                  marcas: current.marcas.map((row) =>
                    row.Id === data.row?.Id ? { ...row, Nombre: data.row.Nombre } : row,
                  ),
                }
              : {
                  gruposContables: current.gruposContables.map((row) =>
                    row.Id === data.row?.Id ? { ...row, Nombre: data.row.Nombre } : row,
                  ),
                }),
        }));
        setCatalogDrafts((current) => ({
          ...current,
          [catalogEdit.category]: "",
        }));
      }

      setCatalogEdit(null);
    } catch (updateError) {
      setCatalogError(
        updateError instanceof Error
          ? updateError.message
          : "No fue posible actualizar el catálogo.",
      );
    } finally {
      setCatalogSaving(null);
    }
  }

  async function handleDeleteCatalog(category: CatalogKey, row: CatalogRow) {
    const confirmed = window.confirm(
      `¿Eliminar "${row.Nombre}"? Solo se podrá borrar si no está asociado a ningún activo fijo.`,
    );
    if (!confirmed) {
      return;
    }

    setCatalogSaving(category);
    setCatalogError(null);

    try {
      const response = await fetch(catalogRoute(category), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete",
          id: row.Id,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? `No fue posible eliminar ${buildCatalogLabel(category).toLowerCase()}.`);
      }

      setCatalogos((current) => ({
        ...current,
        ...(category === "tipo"
          ? { tipos: current.tipos.filter((item) => item.Id !== row.Id) }
          : category === "marca"
            ? { marcas: current.marcas.filter((item) => item.Id !== row.Id) }
            : {
                gruposContables: current.gruposContables.filter((item) => item.Id !== row.Id),
              }),
      }));

      if (catalogEdit?.category === category && catalogEdit.id === row.Id) {
        setCatalogEdit(null);
      }
    } catch (deletionError) {
      setCatalogError(
        deletionError instanceof Error
          ? deletionError.message
          : "No fue posible eliminar el catálogo.",
      );
    } finally {
      setCatalogSaving(null);
    }
  }

  return (
    <div
      className={`grid gap-6 ${
        showSidePanels ? "xl:grid-cols-[560px_minmax(0,1fr)]" : ""
      }`}
    >
      {showSidePanels && (
        <div className="grid gap-6">
        <form
          onSubmit={handleSubmit}
          hidden={!showForm}
          className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
                Activo fijo
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                {selectedId ? "Editar registro" : "Nuevo registro"}
              </h3>
            </div>

          </div>

          <div className="mt-6 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                AF
                <input
                  value={form.AF}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, AF: event.target.value }))
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                OC
                <input
                  value={form.OC}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, OC: event.target.value }))
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Descripción
              <input
                value={form.Descripcion}
                onChange={(event) =>
                  setForm((current) => ({ ...current, Descripcion: event.target.value }))
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Tipo de Activo
                <select
                  value={form.TipoActivoId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, TipoActivoId: event.target.value }))
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="">Sin tipo</option>
                  {catalogos.tipos.map((option) => (
                    <option key={option.Id} value={option.Id}>
                      {option.Nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Marca
                <select
                  value={form.MarcaId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, MarcaId: event.target.value }))
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="">Sin marca</option>
                  {catalogos.marcas.map((option) => (
                    <option key={option.Id} value={option.Id}>
                      {option.Nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Modelo
              <input
                value={form.Modelo}
                onChange={(event) =>
                  setForm((current) => ({ ...current, Modelo: event.target.value }))
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Serie / Patente
                <input
                  value={form.SeriePatente}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      SeriePatente: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Nro. Factura
                <input
                  value={form.NumeroFactura}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, NumeroFactura: event.target.value }))
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Fecha Factura
                <input
                  type="date"
                  value={form.FechaFactura}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, FechaFactura: event.target.value }))
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
                <span className="text-[11px] font-normal text-slate-500">
                  El año se calcula automáticamente desde esta fecha.
                </span>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Valor
                <input
                  type="number"
                  step="0.01"
                  value={form.Valor}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, Valor: event.target.value }))
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Propio / Leasing
                <select
                  value={form.PropioLeasing}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, PropioLeasing: event.target.value }))
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="">Sin definir</option>
                  <option value="Propio">Propio</option>
                  <option value="Leasing">Leasing</option>
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.TotalmenteDepreciado}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      TotalmenteDepreciado: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-200"
                />
                <span>Totalmente Depreciado</span>
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Grupo Contable
              <select
                value={form.GrupoContableId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    GrupoContableId: event.target.value,
                  }))
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="">Sin grupo</option>
                {catalogos.gruposContables.map((option) => (
                  <option key={option.Id} value={option.Id}>
                    {option.Nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Observación
              <textarea
                rows={4}
                value={form.Observacion}
                onChange={(event) =>
                  setForm((current) => ({ ...current, Observacion: event.target.value }))
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando..." : selectedId ? "Guardar cambios" : "Crear activo fijo"}
            </button>
          </div>
        </form>

        <div
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          hidden={!showCatalogs}
        >
          <div className="mt-0 grid gap-4">
            {(["tipo", "marca", "grupoContable"] as CatalogKey[]).map((category) => {
              const rows = getCatalogRows(catalogos, category);

              return (
                <div key={category} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {buildCatalogLabel(category)}
                    </p>
                    <span className="text-xs text-slate-500">{rows.length} registros</span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      value={catalogDrafts[category]}
                      onChange={(event) =>
                        setCatalogDrafts((current) => ({
                          ...current,
                          [category]: event.target.value,
                        }))
                      }
                      placeholder={`Nuevo ${buildCatalogLabel(category).toLowerCase()}`}
                      className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                    />
                    <button
                      type="button"
                      onClick={() => void handleAddCatalog(category)}
                      disabled={catalogSaving === category}
                      className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {catalogSaving === category ? "..." : "Agregar"}
                    </button>
                  </div>

                  {rows.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {rows.map((row) => {
                        const isEditing =
                          catalogEdit?.category === category && catalogEdit.id === row.Id;

                        return (
                          <div
                            key={row.Id}
                            className="flex flex-col gap-2 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                          >
                            {isEditing ? (
                              <>
                                <input
                                  value={catalogEdit.nombre}
                                  onChange={(event) =>
                                    setCatalogEdit((current) =>
                                      current
                                        ? { ...current, nombre: event.target.value }
                                        : current,
                                    )
                                  }
                                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleUpdateCatalog()}
                                    disabled={catalogSaving === category}
                                    className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {catalogSaving === category ? "..." : "Guardar"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditCatalog}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="text-sm font-medium text-slate-800">
                                  {row.Nombre}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => startEditCatalog(category, row)}
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteCatalog(category, row)}
                                  className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                                >
                                  Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">Aún no hay opciones creadas.</p>
                  )}
                </div>
              );
            })}
          </div>

          {catalogError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {catalogError}
            </div>
          ) : null}
        </div>
      </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
                Inventario
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                Lista de activos fijos
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {filteredActivos.length} de {activos.length} registros visibles
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={showForm ? resetForm : openNewForm}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                {showForm ? "Cerrar formulario" : "Nuevo activo fijo"}
              </button>

              <button
                type="button"
                onClick={() => setShowCatalogs((current) => !current)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {showCatalogs ? "Cerrar catálogos" : "Abrir catálogos"}
              </button>

              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 xl:col-span-2">
            Buscar
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="AF, OC, factura, marca, modelo..."
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </label>

          <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Tipo
            <select
              value={tipoFilter}
              onChange={(event) => setTipoFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            >
              <option value="">Todos</option>
              {catalogos.tipos.map((option) => (
                <option key={option.Id} value={option.Id}>
                  {option.Nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Marca
            <select
              value={marcaFilter}
              onChange={(event) => setMarcaFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            >
              <option value="">Todas</option>
              {catalogos.marcas.map((option) => (
                <option key={option.Id} value={option.Id}>
                  {option.Nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Grupo
            <select
              value={grupoFilter}
              onChange={(event) => setGrupoFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            >
              <option value="">Todos</option>
              {catalogos.gruposContables.map((option) => (
                <option key={option.Id} value={option.Id}>
                  {option.Nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Año
            <input
              value={anioFilter}
              onChange={(event) => setAnioFilter(event.target.value)}
              inputMode="numeric"
              placeholder="2024"
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
        </div>

        <div className="max-h-[calc(100vh-20rem)] overflow-auto">
          <table className="min-w-[2200px] divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">{sortLabel("AF", "AF")}</th>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">{sortLabel("OC", "OC")}</th>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">{sortLabel("Descripción", "Descripcion")}</th>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">{sortLabel("Tipo AF", "TipoActivo")}</th>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">{sortLabel("Marca", "Marca")}</th>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">{sortLabel("Modelo", "Modelo")}</th>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">{sortLabel("Nro. Serie / Patente", "SeriePatente")}</th>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">{sortLabel("Observación", "Observacion")}</th>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">{sortLabel("N° Factura", "NumeroFactura")}</th>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">{sortLabel("Fecha Factura", "FechaFactura")}</th>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">{sortLabel("Valor", "Valor")}</th>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">{sortLabel("Propio/Leasing", "PropioLeasing")}</th>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">
                  {sortLabel("Totalmente Depreciado", "TotalmenteDepreciado")}
                </th>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">
                  {sortLabel("Grupo Contable", "GrupoContable")}
                </th>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">{sortLabel("Año", "Anio")}</th>
                <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredActivos.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-slate-500" colSpan={16}>
                    No hay activos fijos que coincidan con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredActivos.map((row) => {
                  const isSelected = row.Id === selectedId;

                  return (
                    <tr key={row.Id} className={isSelected ? "bg-cyan-50" : "bg-white"}>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.AF}</td>
                      <td className="px-4 py-3 text-slate-700">{formatNullable(row.OC)}</td>
                      <td className="px-4 py-3 text-slate-700">{row.Descripcion}</td>
                      <td className="px-4 py-3 text-slate-700">{formatNullable(row.TipoActivo)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatNullable(row.Marca)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatNullable(row.Modelo)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatNullable(row.SeriePatente)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="max-w-[260px] whitespace-pre-wrap">
                          {formatNullable(row.Observacion)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatNullable(row.NumeroFactura)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.FechaFactura ? formatDateDdMmYyyy(row.FechaFactura) : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatCurrency(row.Valor)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatNullable(row.PropioLeasing)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatBoolean(row.TotalmenteDepreciado)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatNullable(row.GrupoContable)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatNullable(row.Anio)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedActivo ? (
        <p className="text-xs text-slate-500">
          Editando: {selectedActivo.AF} - {selectedActivo.Descripcion}
        </p>
      ) : null}
    </div>
  );
}
