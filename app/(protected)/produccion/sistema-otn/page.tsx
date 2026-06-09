import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { listSistemaOtnRows } from "@/lib/sistema-otn-sql";
import { SistemaOtnManager } from "./sistema-otn-manager";

export const dynamic = "force-dynamic";

export default async function SistemaOtnPage() {
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

  const rows = await listSistemaOtnRows();

  return (
    <section className="grid gap-6">
      <SistemaOtnManager initialRows={rows} />
    </section>
  );
}
