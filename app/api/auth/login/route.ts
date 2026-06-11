import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import {
  authenticateUser,
  createSession,
  recordAccessLog,
  AUTH_COOKIE_NAME,
} from "@/lib/auth-sql";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const timings: string[] = [];
    const mark = (label: string, start: number) => {
      const duration = performance.now() - start;
      timings.push(`${label};dur=${duration.toFixed(1)}`);
      return duration;
    };

    const totalStart = performance.now();

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

    const authStart = performance.now();
    const user = await authenticateUser(usuario, password);
    mark("auth", authStart);

    if (!user) {
      const response = NextResponse.json(
        { error: "Credenciales inválidas o usuario inactivo." },
        { status: 401 },
      );

      response.headers.set("Server-Timing", timings.join(", "));
      return response;
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ipAddress =
      forwardedFor?.split(",")[0]?.trim() || realIp || request.headers.get("cf-connecting-ip");

    const sessionStart = performance.now();
    const session = await createSession(user);
    mark("session", sessionStart);

    void recordAccessLog(user, ipAddress).catch(() => undefined);

    const response = NextResponse.json({
      ok: true,
      user,
      timings: process.env.NODE_ENV === "development" ? timings : undefined,
    });

    response.cookies.set(AUTH_COOKIE_NAME, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    mark("total", totalStart);
    response.headers.set("Server-Timing", timings.join(", "));

    if (process.env.NODE_ENV === "development") {
      console.info(`[login] ${timings.join(" | ")}`);
    }

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible iniciar sesión.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
