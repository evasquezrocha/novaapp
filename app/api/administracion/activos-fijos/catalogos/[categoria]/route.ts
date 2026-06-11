import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import {
  countCatalogItemUsage,
  createCatalogItem,
  deleteCatalogItem,
  getCatalogItemById,
  getCatalogItemByName,
  updateCatalogItem,
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
    const body = (await request.json()) as {
      action?: "create" | "update" | "delete";
      id?: number;
      nombre?: string;
    };

    if (body.action === "update") {
      const id = body.id;
      const nombre = body.nombre?.trim();

      if (!id || !Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Debes indicar un id válido." }, { status: 400 });
      }

      if (!nombre) {
        return NextResponse.json({ error: "Debes indicar un nombre." }, { status: 400 });
      }

      const current = await getCatalogItemById(categoria, id);
      if (!current) {
        return NextResponse.json({ error: "El catálogo no existe." }, { status: 404 });
      }

      const existing = await getCatalogItemByName(categoria, nombre);
      if (existing && existing.Id !== id) {
        return NextResponse.json(
          { error: "Ese elemento ya existe.", row: existing },
          { status: 409 },
        );
      }

      await updateCatalogItem(categoria, id, nombre);
      return NextResponse.json({ ok: true, row: { Id: id, Nombre: nombre } }, { status: 200 });
    }

    if (body.action === "delete") {
      const id = body.id;

      if (!id || !Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Debes indicar un id válido." }, { status: 400 });
      }

      const current = await getCatalogItemById(categoria, id);
      if (!current) {
        return NextResponse.json({ error: "El catálogo no existe." }, { status: 404 });
      }

      const usage = await countCatalogItemUsage(categoria, id);
      if (usage > 0) {
        return NextResponse.json(
          { error: `No se puede eliminar porque está asociado a ${usage} activo(s) fijo(s).` },
          { status: 409 },
        );
      }

      await deleteCatalogItem(categoria, id);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

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
      error instanceof Error ? error.message : "No fue posible guardar el catálogo.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
