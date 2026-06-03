"use client";

import { useMemo, useState } from "react";
import { ROLES } from "@/lib/permissions-config";
import type { UsuarioRow } from "@/lib/usuarios-sql";

type FormState = {
  nombre: string;
  usuario: string;
  correo: string;
  rol: string;
  activo: boolean;
  password: string;
};

const INITIAL_FORM: FormState = {
  nombre: "",
  usuario: "",
  correo: "",
  rol: "Usuario",
  activo: true,
  password: "",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function UsuariosManager({ initialUsers }: { initialUsers: UsuarioRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roleOptions = useMemo(() => [...new Set([form.rol, ...ROLES])], [form.rol]);

  const selectedUser = useMemo(
    () => users.find((user) => user.Id === selectedId) ?? null,
    [selectedId, users],
  );

  function resetForm() {
    setSelectedId(null);
    setForm(INITIAL_FORM);
    setError(null);
  }

  function startEdit(user: UsuarioRow) {
    setSelectedId(user.Id);
    setForm({
      nombre: user.Nombre,
      usuario: user.Usuario,
      correo: user.Correo,
      rol: user.Rol,
      activo: user.Activo,
      password: "",
    });
    setError(null);
  }

  async function refreshUsers() {
    const response = await fetch("/api/usuarios", { cache: "no-store" });
    const payload = (await response.json()) as {
      rows?: UsuarioRow[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(
        payload.error ?? `No fue posible cargar usuarios (${response.status}).`,
      );
    }

    setUsers(payload.rows ?? []);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        nombre: form.nombre.trim(),
        usuario: form.usuario.trim(),
        correo: form.correo.trim(),
        rol: form.rol.trim(),
        activo: form.activo,
        password: form.password.trim(),
      };

      const response = await fetch(
        selectedId ? `/api/usuarios/${selectedId}` : "/api/usuarios",
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
          data.error ??
            `No fue posible ${selectedId ? "actualizar" : "crear"} el usuario.`,
        );
      }

      await refreshUsers();
      resetForm();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "No fue posible guardar el usuario.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    const confirmed = window.confirm("¿Eliminar este usuario?");
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/usuarios/${id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "No fue posible eliminar el usuario.");
      }

      await refreshUsers();

      if (selectedId === id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No fue posible eliminar el usuario.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200 bg-slate-50 p-6"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
              {selectedId ? "Editar usuario" : "Nuevo usuario"}
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              {selectedId ? "Modificar cuenta" : "Crear cuenta"}
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
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Nombre
            <input
              value={form.nombre}
              onChange={(event) =>
                setForm((current) => ({ ...current, nombre: event.target.value }))
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Usuario
            <input
              value={form.usuario}
              onChange={(event) =>
                setForm((current) => ({ ...current, usuario: event.target.value }))
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Correo
            <input
              type="email"
              value={form.correo}
              onChange={(event) =>
                setForm((current) => ({ ...current, correo: event.target.value }))
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Rol
            <select
              value={form.rol}
              onChange={(event) =>
                setForm((current) => ({ ...current, rol: event.target.value }))
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Contraseña {selectedId ? "(dejar en blanco para no cambiar)" : ""}
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </label>

          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(event) =>
                setForm((current) => ({ ...current, activo: event.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
            />
            Activo
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
            {saving ? "Guardando..." : selectedId ? "Guardar cambios" : "Crear usuario"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Usuario</th>
              <th className="px-4 py-3 font-semibold">Correo</th>
              <th className="px-4 py-3 font-semibold">Rol</th>
              <th className="px-4 py-3 font-semibold">Activo</th>
              <th className="px-4 py-3 font-semibold">Creado</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={7}>
                  No hay usuarios creados.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isSelected = user.Id === selectedId;

                return (
                  <tr
                    key={user.Id}
                    className={isSelected ? "bg-cyan-50" : "bg-white"}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {user.Nombre}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{user.Usuario}</td>
                    <td className="px-4 py-3 text-slate-700">{user.Correo}</td>
                    <td className="px-4 py-3 text-slate-700">{user.Rol}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {user.Activo ? "Sí" : "No"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(user.CreadoEn)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(user)}
                          className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(user.Id)}
                          className="rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedUser ? (
        <p className="text-xs text-slate-500">
          Editando: {selectedUser.Nombre} ({selectedUser.Usuario})
        </p>
      ) : null}
    </div>
  );
}
