import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { deleteRole, updateRole } from "@/lib/roles-sql";

export const dynamic = "force-dynamic";

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const resolvedParams = await params;
  const id = parseId(resolvedParams.id);
  if (!id) {
    return NextResponse.json({ error: "El rol seleccionado no es válido." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { nombre?: string };
    const role = await updateRole(id, String(body.nombre ?? ""));
    return NextResponse.json({ ok: true, role });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible actualizar el rol.";
    const status =
      message.includes("no existe") ||
      message.includes("ingresar") ||
      message.includes("válido") ||
      message.includes("sistema")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Permisos", "Eliminar")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const resolvedParams = await params;
  const id = parseId(resolvedParams.id);
  if (!id) {
    return NextResponse.json({ error: "El rol seleccionado no es válido." }, { status: 400 });
  }

  try {
    await deleteRole(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible eliminar el rol.";
    const status =
      message.includes("no existe") ||
      message.includes("asignado") ||
      message.includes("sistema") ||
      message.includes("válido")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
