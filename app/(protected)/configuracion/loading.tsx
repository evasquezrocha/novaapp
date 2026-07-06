export default function Loading() {
  return (
    <section className="grid gap-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="h-3 w-32 rounded-full bg-slate-200" />
        <div className="mt-4 h-10 w-80 rounded-full bg-slate-200" />
        <div className="mt-4 h-4 w-full max-w-3xl rounded-full bg-slate-100" />
      </div>
    </section>
  );
}
