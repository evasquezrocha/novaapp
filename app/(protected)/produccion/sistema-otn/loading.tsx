export default function Loading() {
  return (
    <section className="grid gap-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="h-3 w-32 rounded-full bg-slate-200" />
        <div className="mt-4 h-10 w-80 rounded-full bg-slate-200" />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="h-3 w-20 rounded-full bg-slate-200" />
            <div className="mt-3 h-7 w-full rounded-full bg-slate-100" />
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="h-3 w-20 rounded-full bg-slate-200" />
            <div className="mt-3 h-7 w-5/6 rounded-full bg-slate-100" />
          </div>
        </div>
      </div>
    </section>
  );
}
