export default function ForbiddenPage() {
  return (
    <section className="grid min-h-[60vh] place-items-center">
      <div className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          Acceso denegado
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          No tienes permiso para ver esta sección
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Tu rol actual no tiene acceso a este módulo. Si crees que esto es un error,
          revisa la configuración de permisos o contacta a un administrador.
        </p>
      </div>
    </section>
  );
}
