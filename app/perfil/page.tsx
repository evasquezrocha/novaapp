import Link from "next/link";

export const dynamic = "force-static";

export default function PerfilPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <section className="mx-auto flex min-h-[60vh] max-w-5xl items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#b45309]">
            Vista pública
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Perfil
          </h1>
          <p className="mt-4 max-w-xl text-sm text-slate-600">
            Esta vista quedará pública y por ahora solo sirve como entrada a una subvista de
            prueba.
          </p>
          <div className="mt-6">
            <Link
              href="/perfil/7f3c91"
              className="inline-flex rounded-full bg-[#b45309] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#92400e]"
            >
              Abrir subvista de prueba
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
