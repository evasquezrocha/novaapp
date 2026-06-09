import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import {
  deleteSistemaOtnAprobacionRow,
  updateSistemaOtnAprobacionRow,
} from "@/lib/sistema-otn-aprobaciones-sql";

export const dynamic = "force-dynamic";

function parseId(rawId: string) {
  const parsed = Number(rawId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function authorize() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    return { error: NextResponse.json({ error: "No autorizado." }, { status: 401 }) };
  }

  const permissions = await listPermissions();
  const canModify =
    canAccess(permissions, session.Rol, "Sistema OTN", "Editar") ||
    canAccess(permissions, session.Rol, "Sistema OTN", "Crear") ||
    canAccess(permissions, session.Rol, "Sistema OTN");

  if (!canModify) {
    return { error: NextResponse.json({ error: "No autorizado." }, { status: 403 }) };
  }

  return { ok: true };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await params;
  const parsedId = parseId(id);

  if (!parsedId) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      FechaAprobacion?: string;
      ValorAprobado?: number | null;
      OC?: string | null;
      ReferenciaCliente?: string | null;
    };

    const FechaAprobacion = body.FechaAprobacion?.trim();
    const ValorAprobado = body.ValorAprobado;

    if (!FechaAprobacion) {
      return NextResponse.json({ error: "Fecha de aprobación es obligatoria." }, { status: 400 });
    }

    if (typeof ValorAprobado !== "number" || !Number.isFinite(ValorAprobado)) {
      return NextResponse.json({ error: "Valor aprobado es obligatorio." }, { status: 400 });
    }

    const updated = await updateSistemaOtnAprobacionRow(parsedId, {
      FechaAprobacion,
      ValorAprobado,
      OC: body.OC ?? null,
      ReferenciaCliente: body.ReferenciaCliente ?? null,
    });

    if (!updated) {
      return NextResponse.json({ error: "Aprobación no encontrada." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible actualizar la aprobación.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize();
  if ("error" in auth) {
    return auth.error;
  }

  const { id } = await params;
  const parsedId = parseId(id);

  if (!parsedId) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  try {
    const deleted = await deleteSistemaOtnAprobacionRow(parsedId);

    if (!deleted) {
      return NextResponse.json({ error: "Aprobación no encontrada." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible eliminar la aprobación.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
