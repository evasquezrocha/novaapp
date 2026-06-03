import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { deleteUsuario, getUsuarioById, updateUsuario } from "@/lib/usuarios-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";

export const dynamic = "force-dynamic";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? await getSessionUserByToken(token) : null;
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const permissions = await listPermissions();
    if (!canAccess(permissions, session.Rol, "Usuarios", "Editar")) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const { id: rawId } = await params;
    const id = parseId(rawId);

    if (!id) {
      return NextResponse.json({ error: "Id inválido." }, { status: 400 });
    }

    const body = (await request.json()) as {
      nombre?: string;
      usuario?: string;
      correo?: string;
      rol?: string;
      activo?: boolean;
      password?: string;
    };

    const nombre = body.nombre?.trim();
    const usuario = body.usuario?.trim();
    const correo = body.correo?.trim();
    const rol = body.rol?.trim();

    if (!nombre || !usuario || !correo || !rol) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios para actualizar el usuario." },
        { status: 400 },
      );
    }

    const existing = await getUsuarioById(id);
    if (!existing) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    await updateUsuario({
      id,
      nombre,
      usuario,
      correo,
      rol,
      activo: body.activo ?? true,
      password: body.password?.trim() || undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible actualizar el usuario.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? await getSessionUserByToken(token) : null;
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const permissions = await listPermissions();
    if (!canAccess(permissions, session.Rol, "Usuarios", "Eliminar")) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const { id: rawId } = await params;
    const id = parseId(rawId);

    if (!id) {
      return NextResponse.json({ error: "Id inválido." }, { status: 400 });
    }

    const existing = await getUsuarioById(id);
    if (!existing) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    await deleteUsuario(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible eliminar el usuario.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
