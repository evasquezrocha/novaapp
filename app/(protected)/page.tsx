import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const [session, permissions] = await Promise.all([
    token ? getSessionUserByToken(token) : Promise.resolve(null),
    listPermissions(),
  ]);

  if (!session) {
    redirect("/login");
  }
  const allowedModules = [
    { href: "/produccion", label: "Producción", module: "Producción" },
    { href: "/produccion/sistema-otn", label: "Sistema OTN", module: "Sistema OTN" },
    { href: "/bodega/stock-actual", label: "Bodega", module: "Bodega" },
    { href: "/usuarios", label: "Usuarios", module: "Usuarios" },
    { href: "/configuracion/log", label: "Log", module: "Log" },
    { href: "/configuracion/monitoreo", label: "Monitoreo", module: "Monitoreo" },
    {
      href: "/configuracion/importar-sistema-otn",
      label: "Importar Sistema OTN",
      module: "Administración",
    },
    { href: "/configuracion/permisos", label: "Permisos", module: "Permisos" },
  ].filter((item) => canAccess(permissions, session.Rol, item.module));

  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
          Inicio
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Panel principal
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Usa el menú lateral para entrar a los módulos disponibles.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {allowedModules.length > 0 ? (
            allowedModules.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Ir a {item.label}
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              No tienes módulos habilitados en este momento.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
