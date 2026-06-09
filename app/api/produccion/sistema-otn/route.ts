import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { createSistemaOtnRow, listSistemaOtnRows } from "@/lib/sistema-otn-sql";

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
    const rows = await listSistemaOtnRows();
    return NextResponse.json({ rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible listar Sistema OTN.";

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
      Estado?: string | null;
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

    const OTN = body.OTN?.trim();
    const Estado = body.Estado?.trim() || null;

    if (!OTN) {
      return NextResponse.json({ error: "OTN es obligatorio." }, { status: 400 });
    }

    await createSistemaOtnRow({
      OTN,
      Estado,
      FechaIngreso: body.FechaIngreso ?? null,
      Cliente: body.Cliente ?? null,
      Empresa: body.Empresa ?? null,
      Solicitante: body.Solicitante ?? null,
      CC: body.CC ?? null,
      Cantidad: body.Cantidad ?? null,
      Descripcion: body.Descripcion ?? null,
      ReferenciaCliente: body.ReferenciaCliente ?? null,
      Cotizador: body.Cotizador ?? null,
      Equipo: body.Equipo ?? null,
      FechaPpto: body.FechaPpto ?? null,
      ValorPpto: body.ValorPpto ?? null,
      Plazo: body.Plazo ?? null,
      Observaciones: body.Observaciones ?? null,
      Ruta: body.Ruta ?? null,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible crear el registro.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
