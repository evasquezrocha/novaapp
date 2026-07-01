import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";

export const dynamic = "force-dynamic";

async function assertAccess() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    return { response: NextResponse.json({ error: "No autorizado." }, { status: 401 }) };
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Administración")) {
    return { response: NextResponse.json({ error: "No autorizado." }, { status: 403 }) };
  }

  return { session };
}

function safeName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export async function POST(request: Request) {
  const access = await assertAccess();
  if ("response" in access) {
    return access.response;
  }

  try {
    const formData = await request.formData();
    const kind = String(formData.get("kind") ?? "");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo invalido." }, { status: 400 });
    }

    const isLogo = kind === "logo";
    const isContacto = kind === "contacto";

    if (!isLogo && !isContacto) {
      return NextResponse.json({ error: "Tipo de archivo invalido." }, { status: 400 });
    }

    if (isLogo && !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "El logo debe ser una imagen." }, { status: 400 });
    }

    const rawName = safeName(file.name || "archivo");
    const ext = isContacto ? ".vcf" : path.extname(rawName) || (isLogo ? ".png" : "");
    const folder = path.join(process.cwd(), "public", "uploads", "perfiles-tp", kind);
    await fs.mkdir(folder, { recursive: true });

    const filename = `${Date.now()}-${randomUUID()}${ext}`;
    const targetPath = path.join(folder, filename);
    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetPath, bytes);

    return NextResponse.json({
      ok: true,
      url: `/uploads/perfiles-tp/${kind}/${filename}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible subir el archivo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

