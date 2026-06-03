export default function Loading() {
  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          Bodega
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Búsqueda en OC
        </h2>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-5 w-40 rounded bg-slate-200" />
            <div className="h-4 w-3/4 rounded bg-slate-200" />
            <div className="h-12 rounded-xl bg-slate-100" />
            <div className="h-64 rounded-2xl bg-slate-100" />
          </div>
        </div>
      </div>
    </section>
  );
}
