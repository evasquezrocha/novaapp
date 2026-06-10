import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import {
  deleteSistemaOtnRow,
  getSistemaOtnRowById,
  getSistemaOtnRowByIdFresh,
  updateSistemaOtnRow,
} from "@/lib/sistema-otn-sql";

export const dynamic = "force-dynamic";

function parseId(rawId: string) {
  const parsed = Number(rawId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function pickCurrent<T>(value: T | undefined, current: T) {
  return value === undefined ? current : value;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  const parsedId = parseId(id);

  if (!parsedId) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const row = await getSistemaOtnRowById(parsedId);
  if (!row) {
    return NextResponse.json({ error: "Registro no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ row });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permissions = await listPermissions();
  const canEdit =
    canAccess(permissions, session.Rol, "Sistema OTN", "Editar") ||
    canAccess(permissions, session.Rol, "Sistema OTN");

  if (!canEdit) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const parsedId = parseId(id);

  if (!parsedId) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  try {
    const currentRow = await getSistemaOtnRowById(parsedId);
    if (!currentRow) {
      return NextResponse.json({ error: "Registro no encontrado." }, { status: 404 });
    }

    const body = (await request.json()) as {
      OTN?: string;
      Estado?: string | null;
      EntregaFuente?: string | null;
      FechaIngreso?: string | null;
      Cliente?: string | null;
      Empresa?: string | null;
      Solicitante?: string | null;
      CC?: string | null;
      Cantidad?: number | null;
      Descripcion?: string | null;
      ReferenciaCliente?: string | null;
      Cotizador?: string | null;
      Equipo?: string | null;
      FechaPpto?: string | null;
      ValorPpto?: number | null;
      Plazo?: string | null;
      Observaciones?: string | null;
      Ruta?: string | null;
    };

    const OTN = body.OTN === undefined ? currentRow.OTN : body.OTN.trim();
    const Estado =
      body.Estado === undefined ? currentRow.Estado : body.Estado?.trim() || null;

    if (!OTN) {
      return NextResponse.json({ error: "OTN es obligatorio." }, { status: 400 });
    }

    await updateSistemaOtnRow(parsedId, {
      OTN,
      Estado,
      EntregaFuente:
        body.EntregaFuente === undefined ? currentRow.EntregaFuente : body.EntregaFuente,
      FechaIngreso: pickCurrent(body.FechaIngreso, currentRow.FechaIngreso),
      Cliente: pickCurrent(body.Cliente, currentRow.Cliente),
      Empresa: pickCurrent(body.Empresa, currentRow.Empresa),
      Solicitante: pickCurrent(body.Solicitante, currentRow.Solicitante),
      CC: pickCurrent(body.CC, currentRow.CC),
      Cantidad: pickCurrent(body.Cantidad, currentRow.Cantidad),
      Descripcion: pickCurrent(body.Descripcion, currentRow.Descripcion),
      ReferenciaCliente: pickCurrent(body.ReferenciaCliente, currentRow.ReferenciaCliente),
      Cotizador: pickCurrent(body.Cotizador, currentRow.Cotizador),
      Equipo: pickCurrent(body.Equipo, currentRow.Equipo),
      FechaPpto: pickCurrent(body.FechaPpto, currentRow.FechaPpto),
      ValorPpto: pickCurrent(body.ValorPpto, currentRow.ValorPpto),
      Plazo: pickCurrent(body.Plazo, currentRow.Plazo),
      Observaciones: pickCurrent(body.Observaciones, currentRow.Observaciones),
      Ruta: pickCurrent(body.Ruta, currentRow.Ruta),
    });

    const row = await getSistemaOtnRowByIdFresh(parsedId);

    return NextResponse.json({ ok: true, row });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible actualizar el registro.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Sistema OTN", "Eliminar")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const parsedId = parseId(id);

  if (!parsedId) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  try {
    await deleteSistemaOtnRow(parsedId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible eliminar el registro.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
