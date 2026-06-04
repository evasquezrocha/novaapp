import { DisponibleCcClient } from "./disponible-cc-client";

export default function DisponibleCcPage() {
  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          Produccion
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Disponible CC
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Consulta por centro de costos con la misma organizacion de pestañas de
          Disponible OTN.
        </p>

        <div className="mt-8">
          <DisponibleCcClient />
        </div>
      </div>
    </section>
  );
}
