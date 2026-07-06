export default function Loading() {
  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="h-3 w-28 rounded-full bg-slate-200" />
        <div className="mt-4 h-10 w-72 rounded-full bg-slate-200" />
        <div className="mt-4 h-4 w-full max-w-3xl rounded-full bg-slate-100" />
      </div>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-4 gap-px bg-slate-200">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="h-12 bg-white" />
          ))}
        </div>
      </div>
    </section>
  );
}
