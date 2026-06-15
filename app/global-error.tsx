"use client";

import { useEffect } from "react";
import Link from "next/link";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function GlobalError({ error, unstable_retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-950 text-white">
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/30">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
              Error crítico
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              La plataforma no pudo cargarse
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
              Hubo un fallo en el layout raíz o en un componente compartido. Puedes reintentar la
              carga para que Next vuelva a montar la aplicación.
            </p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200">
              {error.message}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={unstable_retry}
                className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Reintentar
              </button>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Ir al login
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
