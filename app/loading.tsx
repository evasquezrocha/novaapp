export default function Loading() {
  return (
    <div className="min-h-screen bg-[#fff8f1]">
      <div className="mx-auto flex min-h-screen max-w-6xl items-start justify-center px-4 pt-10">
        <div className="w-full max-w-md rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm font-medium text-slate-800 shadow-lg shadow-slate-900/10 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-600" />
            <span>Procesando...</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-cyan-600" />
          </div>
        </div>
      </div>
    </div>
  );
}
