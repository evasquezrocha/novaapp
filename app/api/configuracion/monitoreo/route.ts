import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { createServerTimingContext, getPerformanceSnapshot } from "@/lib/server-performance";

export const dynamic = "force-dynamic";

export async function GET() {
  const timing = createServerTimingContext("GET /api/configuracion/monitoreo");
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
  if (!canAccess(permissions, session.Rol, "Monitoreo")) {
    const response = NextResponse.json({ error: "No autorizado." }, { status: 403 });
    timing.finalize();
    timing.apply(response);
    return response;
  }

  const snapshot = await timing.measure("snapshot", async () => getPerformanceSnapshot());
  const response = NextResponse.json(snapshot);
  timing.finalize();
  timing.apply(response);
  return response;
}
