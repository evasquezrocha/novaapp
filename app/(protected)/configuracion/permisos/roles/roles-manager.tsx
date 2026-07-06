"use client";

import { useMemo, useState } from "react";
import type { RoleRow } from "@/lib/roles-sql";

type FormState = {
  nombre: string;
};

const INITIAL_FORM: FormState = {
  nombre: "",
};

async function readJsonOrText(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as unknown;
  }

  return { error: await response.text() };
}

export function RolesManager({ initialRoles }: { initialRoles: RoleRow[] }) {
  const [roles, setRoles] = useState(initialRoles);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedRole = useMemo(
    () => roles.find((role) => role.Id === selectedId) ?? null,
    [roles, selectedId],
  );

  function resetForm() {
    setSelectedId(null);
    setForm(INITIAL_FORM);
    setError(null);
    setMessage(null);
  }

  function startEdit(role: RoleRow) {
    setSelectedId(role.Id);
    setForm({ nombre: role.Nombre });
    setError(null);
    setMessage(null);
  }

  async function refreshRoles() {
    const response = await fetch("/api/configuracion/roles", { cache: "no-store" });
    const payload = (await readJsonOrText(response)) as {
      roles?: RoleRow[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? `No fue posible cargar roles (${response.status}).`);
    }

    setRoles(payload.roles ?? []);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload = {
        nombre: form.nombre.trim(),
      };

      const response = await fetch(
        selectedId ? `/api/configuracion/roles/${selectedId}` : "/api/configuracion/roles",
        {
          method: selectedId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = (await readJsonOrText(response)) as { error?: string; role?: RoleRow };

      if (!response.ok) {
        throw new Error(data.error ?? `No fue posible ${selectedId ? "actualizar" : "crear"} el rol.`);
      }

      await refreshRoles();
      resetForm();
      setMessage(selectedId ? "Rol actualizado correctamente." : "Rol creado correctamente.");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "No fue posible guardar el rol.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(role: RoleRow) {
    const confirmed = window.confirm(`¿Eliminar el rol ${role.Nombre}?`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/configuracion/roles/${role.Id}`, {
        method: "DELETE",
      });

      const data = (await readJsonOrText(response)) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "No fue posible eliminar el rol.");
      }

      await refreshRoles();

      if (selectedId === role.Id) {
        resetForm();
      }

      setMessage("Rol eliminado correctamente.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "No fue posible eliminar el rol.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
              {selectedId ? "Editar rol" : "Nuevo rol"}
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              {selectedId ? "Actualizar nombre" : "Crear nuevo rol"}
            </h3>
          </div>

          {selectedId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end">
          <label className="grid flex-1 gap-2 text-sm font-medium text-slate-700">
            Nombre del rol
            <input
              value={form.nombre}
              onChange={(event) => setForm({ nombre: event.target.value })}
              placeholder="Ej: Analista"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Guardando..." : selectedId ? "Guardar cambios" : "Agregar rol"}
          </button>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
              Roles disponibles
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Catálogo actual
            </h3>
          </div>
          <p className="text-sm text-slate-500">
            Los roles de sistema no se pueden editar ni eliminar.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => {
            const isEditing = role.Id === selectedId;

            return (
              <article
                key={role.Id}
                className={[
                  "rounded-2xl border p-4",
                  isEditing ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-slate-50",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-950">{role.Nombre}</p>
                    <p className="mt-1 text-xs text-slate-500">Orden {role.Orden}</p>
                  </div>
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-xs font-semibold",
                      role.EsSistema
                        ? "bg-cyan-100 text-cyan-800"
                        : "bg-slate-200 text-slate-700",
                    ].join(" ")}
                  >
                    {role.EsSistema ? "Sistema" : "Custom"}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(role)}
                    disabled={saving || role.EsSistema}
                    className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(role)}
                    disabled={saving || role.EsSistema}
                    className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>

                {role.EsSistema ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Protegido para mantener la configuración base.
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>

        {selectedRole ? (
          <p className="mt-4 text-xs text-slate-500">
            Editando: {selectedRole.Nombre}
          </p>
        ) : null}
      </div>
    </div>
  );
}
