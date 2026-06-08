import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import {
  createCatalogItem,
  getCatalogItemByName,
  type CatalogKey,
} from "@/lib/activos-fijos-sql";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set<CatalogKey>(["tipo", "marca", "grupoContable"]);

function isCatalogKey(value: string): value is CatalogKey {
  return VALID_CATEGORIES.has(value as CatalogKey);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ categoria: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Administración", "Crear")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { categoria } = await params;
  if (!isCatalogKey(categoria)) {
    return NextResponse.json({ error: "Catálogo inválido." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { nombre?: string };
    const nombre = body.nombre?.trim();

    if (!nombre) {
      return NextResponse.json({ error: "Debes indicar un nombre." }, { status: 400 });
    }

    const existing = await getCatalogItemByName(categoria, nombre);
    if (existing) {
      return NextResponse.json(
        { error: "Ese elemento ya existe.", row: existing },
        { status: 409 },
      );
    }

    await createCatalogItem(categoria, nombre);
    const row = await getCatalogItemByName(categoria, nombre);

    return NextResponse.json({ ok: true, row }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible crear el catálogo.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
