import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { getSistemaOtnRowByOtn } from "@/lib/sistema-otn-sql";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Sistema OTN")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const otn = url.searchParams.get("otn")?.trim() ?? "";

  if (!otn) {
    return NextResponse.json({ error: "OTN es obligatoria." }, { status: 400 });
  }

  try {
    const row = await getSistemaOtnRowByOtn(otn);

    if (!row) {
      return NextResponse.json({ error: "OTN no encontrada." }, { status: 404 });
    }

    return NextResponse.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible buscar la OTN.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
