"use client";

import { useEffect } from "react";
import Link from "next/link";

type AppErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function AppError({ error, unstable_retry }: AppErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-3xl border border-rose-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-600">
          Error
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          No se pudo cargar esta sección
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          La aplicación encontró un error inesperado al renderizar esta ruta.
        </p>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          {error.message}
        </div>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={unstable_retry}
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
