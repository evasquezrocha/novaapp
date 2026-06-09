import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";

export const dynamic = "force-dynamic";

async function openInExplorer(ruta: string) {
  const normalized = ruta.trim();
  if (!normalized) {
    throw new Error("La ruta está vacía.");
  }

  const resolved = path.isAbsolute(normalized) ? normalized : path.resolve(normalized);
  await access(resolved);

  const child = spawn("explorer.exe", [resolved], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

export async function POST(request: Request) {
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

  try {
    const body = (await request.json()) as { ruta?: string };
    const ruta = body.ruta?.trim();

    if (!ruta) {
      return NextResponse.json({ error: "La ruta es obligatoria." }, { status: 400 });
    }

    await openInExplorer(ruta);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible abrir la ruta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
