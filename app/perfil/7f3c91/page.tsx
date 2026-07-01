import Link from "next/link";

export const dynamic = "force-static";

export default function PerfilCodigoPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <section className="mx-auto flex min-h-[60vh] max-w-5xl items-start">
        <div className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#b45309]">
            Vista pública
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Perfil
          </h1>
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
              Codigo
            </p>
            <p className="mt-2 text-3xl font-bold tracking-[0.22em] text-slate-950">7f3c91</p>
          </div>
          <p className="mt-6 text-sm text-slate-600">
            Esta es una subvista pública de prueba dentro de Perfil.
          </p>
          <div className="mt-6">
            <Link
              href="/perfil"
              className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Volver a Perfil
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
