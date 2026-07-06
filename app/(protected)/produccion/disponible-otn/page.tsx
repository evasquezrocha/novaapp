import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { getActiveSapCompany } from "@/lib/sap-stock";
import { DisponibleOtnClient } from "./disponible-otn-client";

export default async function DisponibleOtnPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const [permissions, activeCompany] = await Promise.all([
    listPermissions(),
    getActiveSapCompany(),
  ]);

  if (!canAccess(permissions, session.Rol, "Producción")) {
    redirect("/forbidden");
  }

  return (
    <section className="grid gap-6">
      <DisponibleOtnClient currentCompanyKey={activeCompany.key} />
    </section>
  );
}
