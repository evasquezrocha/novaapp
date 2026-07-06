export default function Loading() {
  return (
    <section className="grid gap-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-3 w-24 rounded-full bg-slate-200" />
        <div className="mt-3 h-10 w-64 rounded-full bg-slate-200" />
        <div className="mt-3 h-4 w-full max-w-2xl rounded-full bg-slate-100" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="h-3 w-20 rounded-full bg-slate-200" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-10 rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-3 w-28 rounded-full bg-slate-200" />
          <div className="mt-4 h-56 rounded-3xl bg-slate-100" />
        </div>
      </div>
    </section>
  );
}
