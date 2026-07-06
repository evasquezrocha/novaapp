import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { ImportSistemaOtnClient } from "./import-sistema-otn-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ImportSistemaOtnPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const permissions = await listPermissions();
  const isSupervisor = session.Rol === "Supervisor";
  const canSeeImport =
    !isSupervisor &&
    (canAccess(permissions, session.Rol, "Administración") ||
      canAccess(permissions, session.Rol, "Permisos"));

  if (!canSeeImport) {
    redirect("/forbidden");
  }

  return (
    <section className="grid gap-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 p-8 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">
            Configuración
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight">
            Importar Sistema OTN
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200">
            Sube un archivo Excel con la hoja principal. Las hojas de aprobaciones y entregas manuales son opcionales y solo se usan si el archivo las incluye.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/api/configuracion/importar-sistema-otn/plantilla"
              className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Descargar plantilla Excel
            </Link>
          </div>
        </div>

        <div className="grid gap-4 border-t border-slate-200 bg-slate-50/80 p-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Archivo
            </p>
            <p className="mt-3 text-sm text-slate-700">
              `.xlsx` o `.xlsm` con `sistema-otn`. `sistema-otn-aprobaciones` y `sistema-otn-entregas-manuales` son opcionales.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Validación
            </p>
            <p className="mt-3 text-sm text-slate-700">
              Revisa OTN duplicadas y relaciones faltantes antes de escribir.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Hojas
            </p>
            <p className="mt-3 text-sm text-slate-700">
              `sistema-otn` es obligatoria. Las otras dos hojas son opcionales.
            </p>
          </div>
        </div>
      </div>

      <ImportSistemaOtnClient />
    </section>
  );
}

