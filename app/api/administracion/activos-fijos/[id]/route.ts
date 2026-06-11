import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { getActivoFijoById, updateActivoFijo } from "@/lib/activos-fijos-sql";

export const dynamic = "force-dynamic";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? await getSessionUserByToken(token) : null;
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const permissions = await listPermissions();
    if (!canAccess(permissions, session.Rol, "Administración", "Editar")) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) {
      return NextResponse.json({ error: "Id inválido." }, { status: 400 });
    }

    const existing = await getActivoFijoById(id);
    if (!existing) {
      return NextResponse.json({ error: "Activo fijo no encontrado." }, { status: 404 });
    }

    const body = (await request.json()) as {
      AF?: string;
      OC?: string | null;
      Descripcion?: string;
      TipoActivoId?: number | null;
      MarcaId?: number | null;
      Modelo?: string | null;
      SeriePatente?: string | null;
      NumeroFactura?: string | null;
      FechaFactura?: string | null;
      Valor?: number | null;
      PropioLeasing?: string | null;
      TotalmenteDepreciado?: boolean | null;
      Observacion?: string | null;
      GrupoContableId?: number | null;
    };

    const AF = body.AF?.trim();
    const Descripcion = body.Descripcion?.trim();

    if (!AF || !Descripcion) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios para actualizar el activo fijo." },
        { status: 400 },
      );
    }

    await updateActivoFijo({
      id,
      AF,
      OC: body.OC?.trim() || null,
      Descripcion,
      TipoActivoId: body.TipoActivoId ?? null,
      MarcaId: body.MarcaId ?? null,
      Modelo: body.Modelo?.trim() || null,
      SeriePatente: body.SeriePatente?.trim() || null,
      NumeroFactura: body.NumeroFactura?.trim() || null,
      FechaFactura: body.FechaFactura?.trim() || null,
      Valor: body.Valor ?? null,
      PropioLeasing: body.PropioLeasing?.trim() || null,
      TotalmenteDepreciado: body.TotalmenteDepreciado ?? false,
      Observacion: body.Observacion?.trim() || null,
      GrupoContableId: body.GrupoContableId ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible actualizar el activo fijo.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
