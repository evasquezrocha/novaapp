export default function Loading() {
  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="h-3 w-32 rounded-full bg-slate-200" />
        <div className="mt-4 h-10 w-80 rounded-full bg-slate-200" />
        <div className="mt-4 h-4 w-full max-w-3xl rounded-full bg-slate-100" />
        <div className="mt-2 h-4 w-5/6 rounded-full bg-slate-100" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-3 w-24 rounded-full bg-slate-200" />
            <div className="mt-4 h-7 w-full rounded-full bg-slate-100" />
            <div className="mt-3 h-7 w-5/6 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </section>
  );
}
