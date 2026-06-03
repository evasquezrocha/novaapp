"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

function KeyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M15.5 14.5a5 5 0 1 0-5-5" strokeLinecap="round" />
      <path d="M10.5 9.5 3 17v4h4l2-2h3l2-2h2l1.5-1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

type SessionCardProps = {
  name: string;
  role: string;
};

export function SessionCard({ name, role }: SessionCardProps) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const logoutOnPageHide = () => {
      if (typeof navigator === "undefined") {
        return;
      }

      const logoutBody = new Blob([], { type: "text/plain" });

      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/auth/logout", logoutBody);
        return;
      }

      void fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        keepalive: true,
      }).catch(() => {
        // Intentionally ignored. This runs while the tab is closing or reloading.
      });
    };

    window.addEventListener("pagehide", logoutOnPageHide);

    return () => {
      window.removeEventListener("pagehide", logoutOnPageHide);

      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError("Completa todos los campos.");
      return;
    }

    if (newPassword.trim().length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("La nueva contraseña y su confirmación no coinciden.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible cambiar la contraseña.");
      }

      setSuccess("Contraseña actualizada.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      closeTimerRef.current = setTimeout(() => {
        setOpen(false);
        setSuccess(null);
      }, 900);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible cambiar la contraseña.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mt-10 rounded-2xl border border-[#f3d2b1]/20 bg-white/6 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#f3d2b1]">
              Sesión
            </p>
            <p className="mt-2 text-sm font-medium text-white">{name}</p>
            <p className="text-xs text-white/75">{role}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            title="Cambiar contraseña"
            aria-label="Cambiar contraseña"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#f3d2b1]/20 bg-white/10 text-white transition hover:bg-white/20"
          >
            <KeyIcon />
          </button>
        </div>
        <form action="/api/auth/logout" method="post" className="mt-4">
          <button
            type="submit"
            className="w-full rounded-full border border-[#f3d2b1]/20 bg-[#ff9200] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ffb347]"
          >
            Cerrar sesión
          </button>
        </form>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
                  Seguridad
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Cambiar contraseña
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {name}. Ingresa tu contraseña actual y la nueva contraseña.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (closeTimerRef.current) {
                    clearTimeout(closeTimerRef.current);
                    closeTimerRef.current = null;
                  }
                  setOpen(false);
                  setError(null);
                  setSuccess(null);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition hover:bg-slate-100"
                aria-label="Cerrar"
              >
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">
                  Contraseña actual
                </span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  autoComplete="current-password"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">
                  Nueva contraseña
                </span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  autoComplete="new-password"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">
                  Confirmar nueva contraseña
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  autoComplete="new-password"
                />
              </label>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (closeTimerRef.current) {
                      clearTimeout(closeTimerRef.current);
                      closeTimerRef.current = null;
                    }
                    setOpen(false);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#ff9200] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ffb347] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar cambio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
