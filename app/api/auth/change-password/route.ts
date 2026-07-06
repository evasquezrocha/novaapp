import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  AUTH_COOKIE_NAME,
  createSession,
  getSessionUserByToken,
  revokeSessionsForUser,
  verifyPassword,
} from "@/lib/auth-sql";
import { MIN_PASSWORD_LENGTH, findUsuarioForLoginByUsuario, updateUsuarioPassword } from "@/lib/usuarios-sql";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  let body: {
    currentPassword?: string;
    newPassword?: string;
  };

  try {
    body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es válido." },
      { status: 400 },
    );
  }

  const currentPassword = body.currentPassword;
  const newPassword = body.newPassword;

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Debes ingresar la contraseña actual y la nueva contraseña." },
      { status: 400 },
    );
  }

  if (newPassword.trim().length === 0) {
    return NextResponse.json(
      { error: "La nueva contraseña no puede estar vacía." },
      { status: 400 },
    );
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      {
        error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      },
      { status: 400 },
    );
  }

  const user = await findUsuarioForLoginByUsuario(session.Usuario);
  if (!user) {
    return NextResponse.json(
      { error: "No fue posible validar el usuario actual." },
      { status: 404 },
    );
  }

  const isValid = await verifyPassword(
    currentPassword,
    user.PasswordSalt,
    user.PasswordHash,
  );

  if (!isValid) {
    return NextResponse.json(
      { error: "La contraseña actual no es correcta." },
      { status: 400 },
    );
  }

  try {
    await updateUsuarioPassword({
      id: user.Id,
      password: newPassword,
    });

    await revokeSessionsForUser(user.Id);
    const freshSession = await createSession({
      Id: user.Id,
      Nombre: user.Nombre,
      Usuario: user.Usuario,
      Rol: user.Rol,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(AUTH_COOKIE_NAME, freshSession.token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible cambiar la contraseña.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
