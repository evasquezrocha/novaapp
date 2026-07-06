export default function Loading() {
  return (
    <section className="grid gap-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-8 bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 p-8 text-white lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="h-3 w-32 rounded-full bg-white/15" />
            <div className="mt-4 h-11 w-72 rounded-2xl bg-white/12" />
            <div className="mt-4 h-4 w-full max-w-2xl rounded-full bg-white/10" />
            <div className="mt-3 h-4 w-5/6 rounded-full bg-white/10" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-sm"
              >
                <div className="h-3 w-20 rounded-full bg-white/15" />
                <div className="mt-4 h-7 w-24 rounded-full bg-white/20" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 border-t border-slate-200 bg-slate-50/80 p-6 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="h-3 w-24 rounded-full bg-slate-200" />
              <div className="mt-4 h-8 w-28 rounded-full bg-slate-200" />
              <div className="mt-3 h-4 w-40 rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-3 w-28 rounded-full bg-slate-200" />
            <div className="mt-4 h-8 w-64 rounded-full bg-slate-200" />
            <div className="mt-3 h-4 w-full rounded-full bg-slate-100" />
            <div className="mt-2 h-4 w-5/6 rounded-full bg-slate-100" />
            <div className="mt-6 flex gap-3">
              <div className="h-10 w-28 rounded-full bg-slate-200" />
              <div className="h-10 w-24 rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
