import Link from "next/link";

export default function ProduccionPage() {
  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          Módulo
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Producción
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Aquí puedes construir las vistas y acciones del área de producción.
        </p>

        <div className="mt-8">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/produccion/disponible-otn"
              className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Disponible OTN
            </Link>
            <Link
              href="/produccion/disponible-cc"
              className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              Disponible CC
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
