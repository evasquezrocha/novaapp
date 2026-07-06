import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { createRole, listRoleRows } from "@/lib/roles-sql";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Permisos")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const roles = await listRoleRows();
    return NextResponse.json({ roles });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible cargar roles.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Permisos", "Editar")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { nombre?: string };
    const role = await createRole(String(body.nombre ?? ""));
    return NextResponse.json({ ok: true, role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible crear el rol.";
    const status = message.includes("existe") || message.includes("ingresar") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
