import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { FichaOtnClient } from "./ficha-otn-client";

export const dynamic = "force-dynamic";

export default async function FichaOtnPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Sistema OTN")) {
    redirect("/forbidden");
  }

  return (
    <section className="grid gap-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-700">
          Sistema OTN
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Ficha OTN
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
          Busca una OTN y revisa su información mediante pestañas compactas.
        </p>
      </div>

      <FichaOtnClient />
    </section>
  );
}
