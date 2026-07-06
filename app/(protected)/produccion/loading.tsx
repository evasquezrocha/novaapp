export default function Loading() {
  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="h-3 w-24 rounded-full bg-slate-200" />
        <div className="mt-4 h-10 w-64 rounded-full bg-slate-200" />
        <div className="mt-4 h-4 w-full max-w-2xl rounded-full bg-slate-100" />
        <div className="mt-2 h-4 w-5/6 rounded-full bg-slate-100" />
        <div className="mt-8 flex gap-3">
          <div className="h-11 w-36 rounded-full bg-slate-200" />
          <div className="h-11 w-36 rounded-full bg-slate-100" />
        </div>
      </div>
    </section>
  );
}
