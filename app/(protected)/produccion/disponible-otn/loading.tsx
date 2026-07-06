export default function Loading() {
  return (
    <section className="grid gap-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="h-3 w-28 rounded-full bg-slate-200" />
        <div className="mt-4 h-10 w-72 rounded-full bg-slate-200" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 p-4">
              <div className="h-3 w-16 rounded-full bg-slate-200" />
              <div className="mt-3 h-7 w-24 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
