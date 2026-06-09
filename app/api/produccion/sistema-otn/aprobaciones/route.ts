import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import {
  createSistemaOtnAprobacionRow,
  listSistemaOtnAprobacionesRows,
} from "@/lib/sistema-otn-aprobaciones-sql";
import { getSistemaOtnRowByOtn } from "@/lib/sistema-otn-sql";

export const dynamic = "force-dynamic";

export async function GET() {
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
    const rows = await listSistemaOtnAprobacionesRows();
    return NextResponse.json({ rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible listar las aprobaciones.";
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

  const permissions = await listPermissions();
  const canCreate =
    canAccess(permissions, session.Rol, "Sistema OTN", "Crear") ||
    canAccess(permissions, session.Rol, "Sistema OTN");

  if (!canCreate) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      OTN?: string;
      FechaAprobacion?: string;
      ValorAprobado?: number | null;
      OC?: string | null;
      ReferenciaCliente?: string | null;
    };

    const OTN = body.OTN?.trim();
    const FechaAprobacion = body.FechaAprobacion?.trim();
    const ValorAprobado = body.ValorAprobado;

    if (!OTN) {
      return NextResponse.json({ error: "OTN es obligatoria." }, { status: 400 });
    }

    if (!FechaAprobacion) {
      return NextResponse.json({ error: "Fecha de aprobación es obligatoria." }, { status: 400 });
    }

    if (typeof ValorAprobado !== "number" || !Number.isFinite(ValorAprobado)) {
      return NextResponse.json({ error: "Valor aprobado es obligatorio." }, { status: 400 });
    }

    const sistemaOtnRow = await getSistemaOtnRowByOtn(OTN);
    if (!sistemaOtnRow) {
      return NextResponse.json({ error: "La OTN no existe." }, { status: 404 });
    }

    await createSistemaOtnAprobacionRow({
      OTN,
      FechaAprobacion,
      ValorAprobado,
      OC: body.OC ?? null,
      ReferenciaCliente: body.ReferenciaCliente ?? sistemaOtnRow.ReferenciaCliente ?? null,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible crear la aprobación.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
