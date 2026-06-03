import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions, savePermissions, type PermissionRow } from "@/lib/permissions-sql";

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
    const permissionRows = await listPermissions();
    return NextResponse.json({ permissions: permissionRows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible cargar permisos.";

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

  const permissionRows = await listPermissions();
  if (!canAccess(permissionRows, session.Rol, "Permisos", "Editar")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { permissions?: PermissionRow[] };
    const submittedPermissions = body.permissions ?? [];

    if (!Array.isArray(submittedPermissions) || submittedPermissions.length === 0) {
      return NextResponse.json(
        { error: "Debes enviar una matriz de permisos válida." },
        { status: 400 },
      );
    }

    await savePermissions(
      submittedPermissions.map((row) => ({
        Rol: String(row.Rol).trim(),
        Modulo: String(row.Modulo).trim(),
        Accion: String(row.Accion).trim(),
        Permitido: Boolean(row.Permitido),
      })),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible guardar permisos.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
