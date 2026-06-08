"use client";

import { useMemo, useState } from "react";
import type {
  ActivoFijoCatalogos,
  ActivoFijoRow,
  CatalogRow,
  CatalogKey,
} from "@/lib/activos-fijos-sql";

type CatalogDrafts = Record<CatalogKey, string>;

type FormState = {
  AF: string;
  OC: string;
  Descripcion: string;
  TipoActivoId: string;
  MarcaId: string;
  Modelo: string;
  SeriePatente: string;
  Anio: string;
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
  | "Anio"
  | "Observacion"
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
  Anio: "",
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
  const [saving, setSaving] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState<CatalogKey | null>(null);
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
  }

  function startEdit(row: ActivoFijoRow) {
    setSelectedId(row.Id);
    setForm({
      AF: row.AF,
      OC: row.OC ?? "",
      Descripcion: row.Descripcion,
      TipoActivoId: row.TipoActivoId ? String(row.TipoActivoId) : "",
      MarcaId: row.MarcaId ? String(row.MarcaId) : "",
      Modelo: row.Modelo ?? "",
      SeriePatente: row.SeriePatente ?? "",
      Anio: row.Anio ? String(row.Anio) : "",
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
        Anio: isValidPositiveInteger(form.Anio),
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
        body: JSON.stringify({ nombre }),
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

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <div className="grid gap-6">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
                {selectedId ? "Editar activo fijo" : "Nuevo activo fijo"}
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                {selectedId ? "Modificar registro" : "Crear registro"}
              </h3>
            </div>

            {selectedId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                Cancelar
              </button>
            ) : null}
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
                Año
                <input
                  inputMode="numeric"
                  value={form.Anio}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, Anio: event.target.value }))
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
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

        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
              Catálogos rápidos
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              Agregar tipos, marcas y grupos
            </h3>
          </div>

          <div className="grid gap-4">
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
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {rows.slice(0, 8).map((row) => (
                        <li
                          key={row.Id}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {row.Nombre}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      Aún no hay opciones creadas.
                    </p>
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

            <button
              type="button"
              onClick={resetFilters}
              className="w-fit rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="grid gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 xl:col-span-2">
            Buscar
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="AF, OC, descripción, marca, modelo..."
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

        <div className="overflow-x-auto">
          <table className="min-w-[1400px] divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">{sortLabel("AF", "AF")}</th>
                <th className="px-4 py-3 font-semibold">{sortLabel("OC", "OC")}</th>
                <th className="px-4 py-3 font-semibold">{sortLabel("Descripción", "Descripcion")}</th>
                <th className="px-4 py-3 font-semibold">{sortLabel("Tipo de Activo", "TipoActivo")}</th>
                <th className="px-4 py-3 font-semibold">{sortLabel("Marca", "Marca")}</th>
                <th className="px-4 py-3 font-semibold">{sortLabel("Modelo", "Modelo")}</th>
                <th className="px-4 py-3 font-semibold">{sortLabel("Serie / Patente", "SeriePatente")}</th>
                <th className="px-4 py-3 font-semibold">{sortLabel("Año", "Anio")}</th>
                <th className="px-4 py-3 font-semibold">{sortLabel("Observación", "Observacion")}</th>
                <th className="px-4 py-3 font-semibold">
                  {sortLabel("Grupo Contable", "GrupoContable")}
                </th>
                <th className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredActivos.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-slate-500" colSpan={11}>
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
                      <td className="px-4 py-3 text-slate-700">{formatNullable(row.Anio)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="max-w-[260px] whitespace-pre-wrap">
                          {formatNullable(row.Observacion)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatNullable(row.GrupoContable)}
                      </td>
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
