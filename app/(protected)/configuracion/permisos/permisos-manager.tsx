"use client";

import { useMemo, useState } from "react";
import type { PermissionRow } from "@/lib/permissions-sql";
import { ACTIONS, MODULES, ROLES } from "@/lib/permissions-config";

function groupByRole(rows: PermissionRow[]) {
  const map = new Map<string, PermissionRow[]>();

  for (const row of rows) {
    const current = map.get(row.Rol) ?? [];
    current.push(row);
    map.set(row.Rol, current);
  }

  return map;
}

export function PermisosManager({ initialPermissions }: { initialPermissions: PermissionRow[] }) {
  const [permissions, setPermissions] = useState(initialPermissions);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byRole = useMemo(() => groupByRole(permissions), [permissions]);

  function togglePermission(role: string, module: string, action: string) {
    setPermissions((current) =>
      current.map((row) =>
        row.Rol === role && row.Modulo === module && row.Accion === action
          ? { ...row, Permitido: !row.Permitido }
          : row,
      ),
    );
  }

  function toggleModuleVisibility(role: string, module: string) {
    setPermissions((current) =>
      current.map((row) =>
        row.Rol === role && row.Modulo === module && row.Accion === "Ver"
          ? { ...row, Permitido: !row.Permitido }
          : row,
      ),
    );
  }

  function isModuleVisible(role: string, module: string) {
    return (
      permissions.find(
        (row) => row.Rol === role && row.Modulo === module && row.Accion === "Ver",
      )?.Permitido ?? false
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/configuracion/permisos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ permissions }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible guardar permisos.");
      }

      setMessage("Permisos guardados correctamente.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "No fue posible guardar permisos.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
              Matriz de permisos
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Roles, módulos y acciones
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Activa o desactiva permisos por rol. La configuración se guarda en la
              base de datos y se puede reutilizar para autorización futura.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
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
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
              Visibilidad
            </p>
            <h4 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Módulos por rol
            </h4>
          </div>
          <p className="text-sm text-slate-500">
            Activa o desactiva qué módulos ve cada rol.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          {ROLES.map((role) => (
            <div key={`visibility-${role}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-700">
                  {role}
                </p>
                <div className="flex flex-wrap gap-2">
                  {MODULES.map((module) => {
                    const visible = isModuleVisible(role, module);

                    return (
                      <button
                        key={`visibility-${role}-${module}`}
                        type="button"
                        onClick={() => toggleModuleVisibility(role, module)}
                        className={[
                          "rounded-full border px-3 py-2 text-xs font-semibold transition",
                          visible
                            ? "border-cyan-700 bg-cyan-700 text-white"
                            : "border-slate-300 bg-white text-slate-600 hover:border-slate-400",
                        ].join(" ")}
                      >
                        {module}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {ROLES.map((role) => {
          const rolePermissions = byRole.get(role) ?? [];

          return (
            <section key={role} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                    Rol
                  </p>
                  <h4 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {role}
                  </h4>
                </div>
                <p className="text-sm text-slate-500">
                  {rolePermissions.filter((item) => item.Permitido).length} permisos activos
                </p>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {MODULES.map((module) => (
                  <article key={`${role}-${module}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-700">
                      {module}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {ACTIONS.map((action) => {
                        const current =
                          permissions.find(
                            (row) =>
                              row.Rol === role &&
                              row.Modulo === module &&
                              row.Accion === action,
                          ) ?? null;
                        const checked = current?.Permitido ?? false;

                        return (
                          <label
                            key={`${role}-${module}-${action}`}
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePermission(role, module, action)}
                              className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-200"
                            />
                            <span>{action}</span>
                          </label>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
