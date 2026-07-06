import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { createUsuario, listUsuarios } from "@/lib/usuarios-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Usuarios")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const rows = await listUsuarios();
    return NextResponse.json({ rows });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible listar los usuarios.";

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
  if (!canAccess(permissions, session.Rol, "Usuarios", "Crear")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
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
    const password = body.password;

    if (!nombre || !usuario || !correo || !rol || !password) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios para crear el usuario." },
        { status: 400 },
      );
    }

    await createUsuario({
      nombre,
      usuario,
      correo,
      rol,
      activo: body.activo ?? true,
      password,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible crear el usuario.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
