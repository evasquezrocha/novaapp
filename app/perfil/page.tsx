import Link from "next/link";
import { listPerfilTpRows } from "@/lib/perfiles-tp-sql";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const perfiles = await listPerfilTpRows();

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-[#fff7ed] to-[#fef3c7] px-6 py-10">
      <section className="mx-auto flex min-h-[60vh] max-w-5xl items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#b45309]">
            Vista publica
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Perfil</h1>
          <p className="mt-4 max-w-xl text-sm text-slate-600">
            Aqui se muestran las vistas publicas creadas desde Administracion &gt; Perfiles TP.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {perfiles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-600 sm:col-span-2">
                Aun no hay perfiles publicados.
              </div>
            ) : (
              perfiles.map((perfil) => (
                <Link
                  key={perfil.Id}
                  href={`/perfil/${perfil.CodigoAleatorio}`}
                  className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {perfil.Empresa}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">{perfil.Nombre}</h2>
                  <p className="mt-2 text-sm text-slate-600">Codigo: {perfil.CodigoAleatorio}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

