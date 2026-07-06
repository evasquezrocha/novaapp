import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import {
  canAccess,
  listPermissions,
  savePermissions,
  type PermissionRow,
} from "@/lib/permissions-sql";
import { ACTIONS, MODULE_SECTIONS, MODULES } from "@/lib/permissions-config";
import { listRoles } from "@/lib/roles-sql";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Permisos")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const permissionRows = await listPermissions();
    return NextResponse.json({ permissions: permissionRows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible cargar permisos.";

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

  const permissionRows = await listPermissions();
  if (!canAccess(permissionRows, session.Rol, "Permisos", "Editar")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { permissions?: PermissionRow[] };
    const submittedPermissions = body.permissions ?? [];
    const allowedRoles = new Set<string>(await listRoles());
    const allowedModules = new Set<string>([
      ...MODULES,
      ...MODULE_SECTIONS.flatMap((section) => section.submodules),
    ]);
    const allowedActions = new Set<string>(ACTIONS);

    if (!Array.isArray(submittedPermissions) || submittedPermissions.length === 0) {
      return NextResponse.json(
        { error: "Debes enviar una matriz de permisos válida." },
        { status: 400 },
      );
    }

    const normalizedPermissions = submittedPermissions.map((row) => {
      const Rol = String(row.Rol).trim();
      const Modulo = String(row.Modulo).trim();
      const Accion = String(row.Accion).trim();

      if (!allowedRoles.has(Rol)) {
        throw new Error(`El rol "${Rol}" no existe.`);
      }

      if (!allowedModules.has(Modulo)) {
        throw new Error(`El módulo "${Modulo}" no existe.`);
      }

      if (!allowedActions.has(Accion)) {
        throw new Error(`La acción "${Accion}" no existe.`);
      }

      return {
        Rol,
        Modulo,
        Accion,
        Permitido: Boolean(row.Permitido),
      };
    });

    await savePermissions(normalizedPermissions);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible guardar permisos.";

    const status = message.includes("no existe") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
