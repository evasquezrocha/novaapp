import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { getStockActualRows } from "@/lib/sap-stock";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { createServerTimingContext } from "@/lib/server-performance";

export const dynamic = "force-dynamic";

export async function GET() {
  const timing = createServerTimingContext("GET /api/bodega/stock-actual");
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await timing.measure("session", () => getSessionUserByToken(token)) : null;

  if (!session) {
    const response = NextResponse.json({ error: "No autorizado." }, { status: 401 });
    timing.finalize();
    timing.apply(response);
    return response;
  }

  const permissions = await timing.measure("permissions", () => listPermissions());
  if (!canAccess(permissions, session.Rol, "Bodega")) {
    const response = NextResponse.json({ error: "No autorizado." }, { status: 403 });
    timing.finalize();
    timing.apply(response);
    return response;
  }

  try {
    const rows = await timing.measure("data", () => getStockActualRows());
    const response = NextResponse.json({ rows });
    timing.finalize();
    timing.apply(response);
    return response;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible consultar el stock actual.";

    const response = NextResponse.json({ error: message }, { status: 500 });
    timing.finalize();
    timing.apply(response);
    return response;
  }
}
