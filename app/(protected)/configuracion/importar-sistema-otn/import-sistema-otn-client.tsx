"use client";

import { useMemo, useState, type ChangeEvent } from "react";

type ValidationPayload = {
  ok: true;
  dryRun: true;
  source: "file" | "directory";
  stats?: ImportStats;
  parentRows?: number;
  approvalRows?: number;
  deliveryRows?: number;
  parentsInserted?: number;
  parentsUpdated?: number;
  approvalsDeleted?: number;
  approvalsInserted?: number;
  deliveriesDeleted?: number;
  deliveriesInserted?: number;
  validations?: {
    duplicateParents?: string[];
    missingRelatedOtNs?: string[];
  };
};

type ImportStats = {
  parentRows: number;
  approvalRows: number;
  deliveryRows: number;
  parentsInserted: number;
  parentsUpdated: number;
  approvalsDeleted: number;
  approvalsInserted: number;
  deliveriesDeleted: number;
  deliveriesInserted: number;
};

type ImportPayload = ValidationPayload & {
  replaceExisting: boolean;
};

type ApiError = { error: string };

function hasValidationPayload(value: unknown): value is ValidationPayload {
  return Boolean(value) && typeof value === "object" && (value as { ok?: unknown }).ok === true;
}

function formatList(values?: string[]) {
  if (!values || values.length === 0) {
    return "Sin observaciones.";
  }

  return values.join(", ");
}

function getStats(payload: ValidationPayload | ImportPayload): ImportStats | null {
  if (payload.stats) {
    return payload.stats;
  }

  const {
    parentRows,
    approvalRows,
    deliveryRows,
    parentsInserted,
    parentsUpdated,
    approvalsDeleted,
    approvalsInserted,
    deliveriesDeleted,
    deliveriesInserted,
  } = payload;

  if (
    parentRows === undefined ||
    approvalRows === undefined ||
    deliveryRows === undefined ||
    parentsInserted === undefined ||
    parentsUpdated === undefined ||
    approvalsDeleted === undefined ||
    approvalsInserted === undefined ||
    deliveriesDeleted === undefined ||
    deliveriesInserted === undefined
  ) {
    return null;
  }

  return {
    parentRows,
    approvalRows,
    deliveryRows,
    parentsInserted,
    parentsUpdated,
    approvalsDeleted,
    approvalsInserted,
    deliveriesDeleted,
    deliveriesInserted,
  };
}

async function submitImport(file: File, dryRun: boolean) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("dryRun", dryRun ? "true" : "false");

  const response = await fetch("/api/configuracion/importar-sistema-otn", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as ValidationPayload | ImportPayload | ApiError;

  if (!response.ok) {
    throw new Error("error" in payload ? payload.error : "No fue posible procesar la importación.");
  }

  return payload;
}

export function ImportSistemaOtnClient() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ValidationPayload | null>(null);
  const [result, setResult] = useState<ImportPayload | null>(null);
  const [loading, setLoading] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileSummary = useMemo(() => {
    if (!file) {
      return "Ningún archivo seleccionado.";
    }

    return `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  }, [file]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setResult(null);
    setError(null);
  }

  async function handlePreview() {
    if (!file) {
      setError("Selecciona un archivo Excel antes de validar.");
      return;
    }

    setLoading("preview");
    setError(null);
    setResult(null);

    try {
      const payload = await submitImport(file, true);
      if (!hasValidationPayload(payload)) {
        throw new Error("La validación no devolvió una respuesta reconocible.");
      }

      setPreview(payload);
    } catch (previewError) {
      setPreview(null);
      setError(previewError instanceof Error ? previewError.message : "No fue posible validar el archivo.");
    } finally {
      setLoading(null);
    }
  }

  async function handleImport() {
    if (!file) {
      setError("Selecciona un archivo Excel antes de importar.");
      return;
    }

    setLoading("import");
    setError(null);

    try {
      const payload = await submitImport(file, false);
      if (!hasValidationPayload(payload)) {
        throw new Error("La importación no devolvió una respuesta reconocible.");
      }

      setResult({
        ...payload,
        replaceExisting: true,
      });
    } catch (importError) {
      setResult(null);
      setError(importError instanceof Error ? importError.message : "No fue posible importar el archivo.");
    } finally {
      setLoading(null);
    }
  }

  const previewStats = preview ? getStats(preview) : null;
  const resultStats = result ? getStats(result) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="sistema-otn-file">
              Archivo Excel
            </label>
            <input
              id="sistema-otn-file"
              type="file"
              accept=".xlsx,.xlsm"
              onChange={handleFileChange}
              className="block w-full cursor-pointer rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
            />
          </div>

          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-700">Estructura mínima</p>
            <ul className="mt-2 space-y-1">
              <li>Hoja `sistema-otn` obligatoria</li>
              <li>Hoja `sistema-otn-aprobaciones` opcional</li>
              <li>Hoja `sistema-otn-entregas-manuales` opcional</li>
            </ul>
          </div>

          <p className="text-sm text-slate-600">{fileSummary}</p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePreview}
              disabled={!file || loading !== null}
              className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading === "preview" ? "Validando..." : "Validar archivo"}
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!file || loading !== null}
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading === "import" ? "Importando..." : "Importar"}
            </button>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold tracking-tight text-slate-950">Vista previa</h3>
          {preview ? (
            <div className="mt-4 grid gap-3 text-sm text-slate-700">
              <div className="grid gap-2 sm:grid-cols-3">
                <Stat label="OTN padres" value={previewStats?.parentRows ?? 0} />
                <Stat label="Aprobaciones" value={previewStats?.approvalRows ?? 0} />
                <Stat label="Entregas" value={previewStats?.deliveryRows ?? 0} />
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-medium text-slate-800">OTN duplicadas</p>
                <p className="mt-2 text-slate-600">
                  {formatList(preview.validations?.duplicateParents)}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-medium text-slate-800">OTN relacionadas faltantes</p>
                <p className="mt-2 text-slate-600">
                  {formatList(preview.validations?.missingRelatedOtNs)}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Valida el archivo para ver un resumen antes de escribir en la base.
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold tracking-tight text-slate-950">Resultado</h3>
          {result ? (
            <div className="mt-4 grid gap-3 text-sm text-slate-700">
              <div className="grid gap-2 sm:grid-cols-2">
                <Stat label="Insertados" value={resultStats?.parentsInserted ?? 0} />
                <Stat label="Actualizados" value={resultStats?.parentsUpdated ?? 0} />
                <Stat label="Aprobaciones" value={resultStats?.approvalsInserted ?? 0} />
                <Stat label="Entregas" value={resultStats?.deliveriesInserted ?? 0} />
              </div>
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-700">
                Importación completada correctamente.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Aquí aparecerá el resultado final cuando ejecutes la importación.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

