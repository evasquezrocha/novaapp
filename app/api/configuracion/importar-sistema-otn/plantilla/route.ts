import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import {
  buildSistemaOtnTemplateXlsx,
  getSistemaOtnTemplateFilename,
} from "@/lib/sistema-otn-template-xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permissions = await listPermissions();
  const canDownload =
    session.Rol !== "Supervisor" &&
    (canAccess(permissions, session.Rol, "Administración") ||
      canAccess(permissions, session.Rol, "Permisos"));

  if (!canDownload) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const buffer = await buildSistemaOtnTemplateXlsx();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${getSistemaOtnTemplateFilename()}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
