import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { deleteSistemaOtnEntregaManualRow } from "@/lib/sistema-otn-entregas-manuales-sql";

export const dynamic = "force-dynamic";

function parseId(rawId: string) {
  const parsed = Number(rawId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
  const canDelete =
    canAccess(permissions, session.Rol, "Sistema OTN", "Eliminar") ||
    canAccess(permissions, session.Rol, "Sistema OTN");

  if (!canDelete) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const parsedId = parseId(id);

  if (!parsedId) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  try {
    const deleted = await deleteSistemaOtnEntregaManualRow(parsedId);
    if (!deleted) {
      return NextResponse.json({ error: "Registro no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible eliminar la entrega manual.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
