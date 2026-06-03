import { NextResponse } from "next/server";
import {
  authenticateUser,
  createSession,
  recordAccessLog,
  AUTH_COOKIE_NAME,
} from "@/lib/auth-sql";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      usuario?: string;
      password?: string;
    };

    const usuario = body.usuario?.trim();
    const password = body.password?.trim();

    if (!usuario || !password) {
      return NextResponse.json(
        { error: "Debes ingresar usuario y contraseña." },
        { status: 400 },
      );
    }

    const user = await authenticateUser(usuario, password);
    if (!user) {
      return NextResponse.json(
        { error: "Credenciales inválidas o usuario inactivo." },
        { status: 401 },
      );
    }

    const session = await createSession(user);
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ipAddress =
      forwardedFor?.split(",")[0]?.trim() || realIp || request.headers.get("cf-connecting-ip");

    await recordAccessLog(user, ipAddress);

    const response = NextResponse.json({ ok: true, user });

    response.cookies.set(AUTH_COOKIE_NAME, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible iniciar sesión.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
