"use client";

import { useMemo, useState } from "react";
import { formatDateTimeDdMmYyyy } from "@/lib/date-format";
import type { PerfilTpRow } from "@/lib/perfiles-tp-sql";

type DraftRow = {
  key: string;
  Empresa: string;
  Logo: string;
  Nombre: string;
  Contacto: string;
  WhatsApp: string;
  Telefono: string;
  Web: string;
  Instagram: string;
  LinkedIn: string;
  Transferencia: string;
  CodigoAleatorio: string;
};

type FormState = {
  rows: DraftRow[];
};

const EMPTY_ROW = (): DraftRow => ({
  key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  Empresa: "",
  Logo: "",
  Nombre: "",
  Contacto: "",
  WhatsApp: "",
  Telefono: "",
  Web: "",
  Instagram: "",
  LinkedIn: "",
  Transferencia: "",
  CodigoAleatorio: generateLocalCodigoAleatorio(),
});

function generateLocalCodigoAleatorio() {
  return `${Math.random().toString(16).slice(2, 6)}${Math.random().toString(16).slice(2, 6)}`.slice(
    0,
    8,
  );
}

function isImageLogo(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith("/uploads/");
}

function formatDate(value: string) {
  return formatDateTimeDdMmYyyy(value);
}

async function readJsonOrText(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as { error?: string };
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

function LinkIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className="h-4 w-4">
      <path
        d="M8.5 11.5l3-3m-6.25 2.25L4 11.5a3 3 0 0 0 0 4.24 3 3 0 0 0 4.24 0l1.25-1.25m2.25-6.75L13 6.5a3 3 0 0 1 4.24 4.24l-1.25 1.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PerfilesTpManager({ initialRows }: { initialRows: PerfilTpRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formRows, setFormRows] = useState<FormState>({ rows: [EMPTY_ROW()] });
  const [preserveLogo, setPreserveLogo] = useState(false);
  const [preserveContacto, setPreserveContacto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = selectedId !== null;
  const selectedRow = useMemo(
    () => rows.find((row) => row.Id === selectedId) ?? null,
    [rows, selectedId],
  );

  function resetForm() {
    setSelectedId(null);
    setFormRows({ rows: [EMPTY_ROW()] });
    setPreserveLogo(false);
    setPreserveContacto(false);
    setError(null);
  }

  function startCreate() {
    resetForm();
  }

  function startEdit(row: PerfilTpRow) {
    const legacyLogo =
      !!row.Logo && (row.Logo.startsWith("data:") || row.Logo.length > 250 || row.Logo.length > 5000);
    const legacyContacto =
      !!row.Contacto &&
      (row.Contacto.startsWith("data:") ||
        row.Contacto.includes("BEGIN:VCARD") ||
        row.Contacto.length > 250 ||
        row.Contacto.length > 5000);

    setSelectedId(row.Id);
    setPreserveLogo(legacyLogo);
    setPreserveContacto(legacyContacto);
    setFormRows({
      rows: [
        {
          key: `row-${row.Id}`,
          Empresa: row.Empresa,
          Logo: legacyLogo ? "" : row.Logo ?? "",
          Nombre: row.Nombre,
          Contacto: legacyContacto ? "" : row.Contacto ?? "",
          WhatsApp: row.WhatsApp ?? "",
          Telefono: row.Telefono ?? "",
          Web: row.Web ?? "",
          Instagram: row.Instagram ?? "",
          LinkedIn: row.LinkedIn ?? "",
          Transferencia: row.Transferencia ?? "",
          CodigoAleatorio: row.CodigoAleatorio,
        },
      ],
    });
    setError(null);
  }

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setFormRows((current) => ({
      rows: current.rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    }));
  }

  async function uploadManagedFile(kind: "logo" | "contacto", file: File) {
    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("file", file);

    const response = await fetch("/api/administracion/perfiles-tp/upload", {
      method: "POST",
      body: formData,
    });

    const payload = (await readJsonOrText(response)) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      throw new Error(payload.error ?? "No fue posible subir el archivo.");
    }

    return payload.url;
  }

  function addRow() {
    setFormRows((current) => ({
      rows: [...current.rows, EMPTY_ROW()],
    }));
  }

  function removeRow(key: string) {
    setFormRows((current) => {
      if (current.rows.length === 1) {
        return current;
      }

      return {
        rows: current.rows.filter((row) => row.key !== key),
      };
    });
  }

  async function refreshRows() {
    const response = await fetch("/api/administracion/perfiles-tp", { cache: "no-store" });
    const payload = (await readJsonOrText(response)) as { rows?: PerfilTpRow[]; error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "No fue posible cargar los perfiles.");
    }

    setRows(payload.rows ?? []);
  }

  async function handleDelete(id: number) {
    const confirmed = window.confirm("Desea eliminar este perfil?");
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/administracion/perfiles-tp/${id}`, {
        method: "DELETE",
      });

      const payload = (await readJsonOrText(response)) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible eliminar el perfil.");
      }

      await refreshRows();

      if (selectedId === id) {
        resetForm();
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "No fue posible eliminar el perfil.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payloadRows = formRows.rows.map((row) => ({
        Empresa: row.Empresa.trim(),
        Logo: row.Logo.trim() || null,
        Nombre: row.Nombre.trim(),
        Contacto: row.Contacto.trim() || null,
        WhatsApp: row.WhatsApp.trim() || null,
        Telefono: row.Telefono.trim() || null,
        Web: row.Web.trim() || null,
        Instagram: row.Instagram.trim() || null,
        LinkedIn: row.LinkedIn.trim() || null,
        Transferencia: row.Transferencia.trim() || null,
        CodigoAleatorio: row.CodigoAleatorio.trim(),
      }));

      const response = await fetch(
        selectedId ? `/api/administracion/perfiles-tp/${selectedId}` : "/api/administracion/perfiles-tp",
        {
          method: selectedId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            selectedId
              ? {
                  row: (() => {
                    const row = payloadRows[0];
                    const update: Record<string, string | number | boolean | null> = {
                      Empresa: row.Empresa,
                      Nombre: row.Nombre,
                      WhatsApp: row.WhatsApp,
                      Telefono: row.Telefono,
                      Web: row.Web,
                      Instagram: row.Instagram,
                      LinkedIn: row.LinkedIn,
                      Transferencia: row.Transferencia,
                      CodigoAleatorio: row.CodigoAleatorio,
                    };

                    if (!preserveLogo || row.Logo) {
                      update.Logo = row.Logo;
                    }

                    if (!preserveContacto || row.Contacto) {
                      update.Contacto = row.Contacto;
                    }

                    return update;
                  })(),
                }
              : { rows: payloadRows },
          ),
        },
      );

      const payload = (await readJsonOrText(response)) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible guardar el perfil.");
      }

      await refreshRows();
      resetForm();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "No fue posible guardar el perfil.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
      <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
              {isEditing ? "Editar perfil" : "Nuevo perfil"}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {isEditing ? "Modificar vista publica" : "Crear vistas publicas"}
            </h3>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
            >
              <PlusIcon />
              Nuevo Perfil
            </button>
            {isEditing ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </div>

        {selectedRow ? (
          <p className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Editando {selectedRow.Empresa}. El codigo publico queda asociado a esta vista.
          </p>
        ) : null}

        <div className="mt-6 space-y-4">
          {formRows.rows.map((row, index) => (
            <div key={row.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Linea {index + 1}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Cada linea crea una subvista publica independiente.
                  </p>
                </div>

                {!isEditing && formRows.rows.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                  >
                    <TrashIcon />
                    Quitar
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Empresa
                  <input
                    value={row.Empresa}
                    onChange={(event) => updateRow(row.key, { Empresa: event.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </label>

                <div className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Logo
                  <div className="grid gap-3 rounded-xl border border-slate-300 bg-white p-3">
                    {row.Logo ? (
                      <div className="flex items-center gap-3">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          {isImageLogo(row.Logo) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.Logo}
                              alt="Vista previa del logo"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="px-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-400">
                              Logo
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10px] font-medium normal-case tracking-normal text-slate-500">
                            {row.Logo.startsWith("data:image/") ? "Imagen cargada" : row.Logo}
                          </p>
                          <button
                            type="button"
                            onClick={() => updateRow(row.key, { Logo: "" })}
                            className="mt-2 rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-medium normal-case tracking-normal text-slate-700 transition hover:bg-slate-50"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[11px] font-medium normal-case tracking-normal text-slate-500">
                        Sin logo
                      </div>
                    )}
                    <label className="grid gap-2 text-[11px] font-medium normal-case tracking-normal text-slate-600">
                      Subir imagen
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          if (!file) {
                            updateRow(row.key, { Logo: "" });
                            return;
                          }

                          void (async () => {
                            try {
                              setError(null);
                              const url = await uploadManagedFile("logo", file);
                              updateRow(row.key, { Logo: url });
                            } catch (uploadError) {
                              setError(
                                uploadError instanceof Error
                                  ? uploadError.message
                                  : "No fue posible subir el logo.",
                              );
                            }
                          })();
                        }}
                        className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-[#b45309] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-[#92400e]"
                      />
                    </label>
                  </div>
                </div>

                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Nombre
                  <input
                    value={row.Nombre}
                    onChange={(event) => updateRow(row.key, { Nombre: event.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </label>

                <div className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Contacto
                  <div className="grid gap-3 rounded-xl border border-slate-300 bg-white p-3">
                    {row.Contacto ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        {row.Contacto.includes("BEGIN:VCARD") || row.Contacto.endsWith(".vcf") ? (
                          <p className="text-[11px] font-medium normal-case tracking-normal text-slate-600">
                            vCard cargada
                          </p>
                        ) : (
                          <p className="truncate text-[11px] font-medium normal-case tracking-normal text-slate-600">
                            {row.Contacto}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => updateRow(row.key, { Contacto: "" })}
                          className="mt-2 rounded-full border border-slate-300 px-3 py-1.5 text-[11px] font-medium normal-case tracking-normal text-slate-700 transition hover:bg-white"
                        >
                          Quitar
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[11px] font-medium normal-case tracking-normal text-slate-500">
                        Sin contacto
                      </div>
                    )}
                    <label className="grid gap-2 text-[11px] font-medium normal-case tracking-normal text-slate-600">
                      Subir vCard
                      <input
                        type="file"
                        accept=".vcf,.vcard,text/vcard"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          if (!file) {
                            updateRow(row.key, { Contacto: "" });
                            return;
                          }

                          const isVCard =
                            file.name.toLowerCase().endsWith(".vcf") || file.type.includes("vcard");
                          if (!isVCard) {
                            setError("El archivo de contacto debe ser una vCard (.vcf).");
                            return;
                          }

                          void (async () => {
                            try {
                              setError(null);
                              const url = await uploadManagedFile("contacto", file);
                              updateRow(row.key, { Contacto: url });
                            } catch (uploadError) {
                              setError(
                                uploadError instanceof Error
                                  ? uploadError.message
                                  : "No fue posible subir la vCard.",
                              );
                            }
                          })();
                        }}
                        className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-[#b45309] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-[#92400e]"
                      />
                    </label>
                  </div>
                </div>

                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  WhatsApp
                  <input
                    value={row.WhatsApp}
                    onChange={(event) => updateRow(row.key, { WhatsApp: event.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </label>

                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Telefono
                  <input
                    value={row.Telefono}
                    onChange={(event) => updateRow(row.key, { Telefono: event.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </label>

                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Web
                  <input
                    value={row.Web}
                    onChange={(event) => updateRow(row.key, { Web: event.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </label>

                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Instagram
                  <input
                    value={row.Instagram}
                    onChange={(event) => updateRow(row.key, { Instagram: event.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </label>

                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  LinkedIn
                  <input
                    value={row.LinkedIn}
                    onChange={(event) => updateRow(row.key, { LinkedIn: event.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </label>

                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Transferencia
                  <input
                    value={row.Transferencia}
                    onChange={(event) => updateRow(row.key, { Transferencia: event.target.value })}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </label>

                <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Codigo Aleatorio
                  <div className="flex gap-2">
                    <input
                      value={row.CodigoAleatorio}
                      readOnly
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
                    />
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => updateRow(row.key, { CodigoAleatorio: generateLocalCodigoAleatorio() })}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
                      >
                        Reponer
                      </button>
                    ) : null}
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>

        {!isEditing ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <PlusIcon />
              Agregar linea
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
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
            {saving ? "Guardando..." : isEditing ? "Actualizar perfil" : "Guardar perfiles"}
          </button>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
              Perfiles publicados
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Lista y enlaces publicos
            </h3>
          </div>
          <button
            type="button"
            onClick={refreshRows}
            className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Refrescar
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              Todavia no hay perfiles cargados.
            </div>
          ) : (
            rows.map((row) => (
              <div key={row.Id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      {row.Empresa}
                    </p>
                    <h4 className="mt-1 text-lg font-semibold text-slate-950">{row.Nombre}</h4>
                    <p className="mt-1 text-sm text-slate-600">
                      Codigo: <span className="font-semibold text-slate-900">{row.CodigoAleatorio}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/perfil/${row.CodigoAleatorio}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
                    >
                      <LinkIcon />
                      Abrir
                    </a>
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
                    >
                      <PencilIcon />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(row.Id)}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <TrashIcon />
                      Eliminar
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  <p>Contacto: {row.Contacto || "-"}</p>
                  <p>WhatsApp: {row.WhatsApp || "-"}</p>
                  <p>Telefono: {row.Telefono || "-"}</p>
                  <p>Web: {row.Web || "-"}</p>
                  <p>Instagram: {row.Instagram || "-"}</p>
                  <p>LinkedIn: {row.LinkedIn || "-"}</p>
                  <p>Transferencia: {row.Transferencia || "-"}</p>
                  <p>Creado: {formatDate(row.CreadoEn)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
