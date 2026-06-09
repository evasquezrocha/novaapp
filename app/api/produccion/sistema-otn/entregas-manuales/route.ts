import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { getSistemaOtnRowByOtn } from "@/lib/sistema-otn-sql";
import { createSistemaOtnEntregaManualRow } from "@/lib/sistema-otn-entregas-manuales-sql";

export const dynamic = "force-dynamic";

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
      FechaEntrega?: string | null;
      ValorEntrega?: number | null;
      ReferenciaEntrega?: string | null;
    };

    const OTN = body.OTN?.trim();
    const FechaEntrega = body.FechaEntrega?.trim();
    const ValorEntrega = body.ValorEntrega;

    if (!OTN) {
      return NextResponse.json({ error: "OTN es obligatoria." }, { status: 400 });
    }

    if (!FechaEntrega) {
      return NextResponse.json({ error: "Fecha de entrega es obligatoria." }, { status: 400 });
    }

    if (typeof ValorEntrega !== "number" || !Number.isFinite(ValorEntrega)) {
      return NextResponse.json({ error: "Valor de entrega es obligatorio." }, { status: 400 });
    }

    const sistemaOtnRow = await getSistemaOtnRowByOtn(OTN);
    if (!sistemaOtnRow) {
      return NextResponse.json({ error: "La OTN no existe." }, { status: 404 });
    }

    await createSistemaOtnEntregaManualRow({
      OTN,
      FechaEntrega,
      ValorEntrega,
      ReferenciaEntrega: body.ReferenciaEntrega ?? null,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible crear la entrega manual.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
