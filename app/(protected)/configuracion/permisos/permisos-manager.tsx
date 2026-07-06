"use client";

import { useEffect, useMemo, useState } from "react";
import type { PermissionRow } from "@/lib/permissions-sql";
import { ACTIONS, MODULE_SECTIONS } from "@/lib/permissions-config";

function groupByRole(rows: PermissionRow[]) {
  const map = new Map<string, PermissionRow[]>();

  for (const row of rows) {
    const current = map.get(row.Rol) ?? [];
    current.push(row);
    map.set(row.Rol, current);
  }

  return map;
}

export function PermisosManager({
  initialPermissions,
  roles,
}: {
  initialPermissions: PermissionRow[];
  roles: string[];
}) {
  const [permissions, setPermissions] = useState(initialPermissions);
  const [saving, setSaving] = useState(false);
  const [visibilitySavingRole, setVisibilitySavingRole] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>(() => {
    const fallbackRole = roles[0] ?? "";

    if (typeof window === "undefined") {
      return fallbackRole;
    }

    const storedRole = window.localStorage.getItem("nova.permissions.role");
    return storedRole && roles.includes(storedRole) ? storedRole : fallbackRole;
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byRole = useMemo(() => groupByRole(permissions), [permissions]);
  const roleOrder = useMemo(() => [...new Set(roles)], [roles]);
  const moduleSections = MODULE_SECTIONS;
  const activeRole = selectedRole && roleOrder.includes(selectedRole) ? selectedRole : roleOrder[0] ?? "";

  useEffect(() => {
    if (activeRole && typeof window !== "undefined") {
      window.localStorage.setItem("nova.permissions.role", activeRole);
    }
  }, [activeRole]);

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
      current.map((row) => {
        if (row.Rol !== role || row.Modulo !== module) {
          return row;
        }

        if (row.Accion === "Ver") {
          return { ...row, Permitido: !row.Permitido };
        }

        return {
          ...row,
          Permitido: false,
        };
      }),
    );
  }

  function isModuleVisible(role: string, module: string) {
    return (
      permissions.find(
        (row) => row.Rol === role && row.Modulo === module && row.Accion === "Ver",
      )?.Permitido ?? false
    );
  }

  async function savePermissionsPayload(nextPermissions: PermissionRow[], successMessage: string) {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/configuracion/permisos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ permissions: nextPermissions }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible guardar permisos.");
      }

      setMessage(successMessage);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "No fue posible guardar permisos.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    await savePermissionsPayload(permissions, "Permisos guardados correctamente.");
  }

  async function handleSaveVisibility(role: string) {
    setVisibilitySavingRole(role);
    try {
      await savePermissionsPayload(
        permissions,
        `Visibilidad del rol ${role} actualizada correctamente.`,
      );
    } finally {
      setVisibilitySavingRole(null);
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Rol seleccionado
              <select
                value={activeRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                {roleOrder.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
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

        {activeRole ? (
          <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-700">
                  {activeRole}
                </p>
                <button
                  type="button"
                  onClick={() => void handleSaveVisibility(activeRole)}
                  disabled={saving || visibilitySavingRole === activeRole}
                  className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {visibilitySavingRole === activeRole ? "Guardando..." : "Guardar visibilidad"}
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              {moduleSections.map((section) => (
                <div
                  key={`visibility-${activeRole}-${section.title}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-700">
                        {section.title}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {section.submodules.map((submodule) => {
                          const visible = isModuleVisible(activeRole, submodule);

                          return (
                            <button
                              key={`visibility-${activeRole}-${section.title}-${submodule}`}
                              type="button"
                              onClick={() => toggleModuleVisibility(activeRole, submodule)}
                              className={[
                                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                                visible
                                  ? "border-cyan-700 bg-cyan-700 text-white"
                                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400",
                              ].join(" ")}
                            >
                              {submodule}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {section.modules.map((module) => {
                        const visible = isModuleVisible(activeRole, module);

                        return (
                          <button
                            key={`visibility-${activeRole}-${module}`}
                            type="button"
                            onClick={() => toggleModuleVisibility(activeRole, module)}
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
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No hay roles para mostrar.
          </div>
        )}
      </div>

      {activeRole ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                Rol
              </p>
              <h4 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {activeRole}
              </h4>
            </div>
            <p className="text-sm text-slate-500">
              {((byRole.get(activeRole) ?? []).filter((item) => item.Permitido).length)} permisos activos
            </p>
          </div>

          <div className="mt-6 grid gap-4">
            {moduleSections.map((section) => (
              <div
                key={`${activeRole}-${section.title}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-700">
                      {section.title}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {section.submodules.map((submodule) => (
                        <span
                          key={`${activeRole}-${section.title}-${submodule}`}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                        >
                          {submodule}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {section.modules.map((module) => {
                    const moduleVisible = isModuleVisible(activeRole, module);

                    return (
                      <article
                        key={`${activeRole}-${module}`}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-700">
                          {module}
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          {ACTIONS.map((action) => {
                            const current =
                              permissions.find(
                                (row) =>
                                  row.Rol === activeRole &&
                                  row.Modulo === module &&
                                  row.Accion === action,
                              ) ?? null;
                            const checked = current?.Permitido ?? false;

                            return (
                              <label
                                key={`${activeRole}-${module}-${action}`}
                                className={[
                                  "flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700",
                                  moduleVisible ? "" : "opacity-50",
                                ].join(" ")}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePermission(activeRole, module, action)}
                                  disabled={!moduleVisible}
                                  className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-200"
                                />
                                <span>{action}</span>
                              </label>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
