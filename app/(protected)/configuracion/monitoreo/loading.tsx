export default function Loading() {
  return (
    <section className="grid gap-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="h-40 rounded-[2rem] bg-slate-100" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 p-4">
              <div className="h-3 w-24 rounded-full bg-slate-200" />
              <div className="mt-3 h-7 w-28 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
