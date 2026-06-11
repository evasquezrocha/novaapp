import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { listActivosFijosPageData } from "@/lib/activos-fijos-sql";
import { ActivosFijosManager } from "./activos-fijos-manager";

export const dynamic = "force-dynamic";

export default async function ActivosFijosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Administración")) {
    redirect("/forbidden");
  }

  const { activos, catalogos } = await listActivosFijosPageData();

  return (
    <section className="grid gap-6">
      <ActivosFijosManager initialActivos={activos} initialCatalogos={catalogos} />
    </section>
  );
}
