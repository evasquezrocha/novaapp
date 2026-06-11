import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import {
  createActivoFijo,
  listActivosFijosCatalogos,
  listActivosFijos,
} from "@/lib/activos-fijos-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { createServerTimingContext } from "@/lib/server-performance";

export const dynamic = "force-dynamic";

export async function GET() {
  const timing = createServerTimingContext("GET /api/administracion/activos-fijos");
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await timing.measure("session", () => getSessionUserByToken(token)) : null;
  if (!session) {
    const response = NextResponse.json({ error: "No autorizado." }, { status: 401 });
    timing.finalize();
    timing.apply(response);
    return response;
  }

  const permissions = await timing.measure("permissions", () => listPermissions());
  if (!canAccess(permissions, session.Rol, "Administración")) {
    const response = NextResponse.json({ error: "No autorizado." }, { status: 403 });
    timing.finalize();
    timing.apply(response);
    return response;
  }

  try {
    const [activos, catalogos] = await timing.measure("data", () =>
      Promise.all([listActivosFijos(), listActivosFijosCatalogos()]),
    );

    const response = NextResponse.json({ activos, catalogos });
    timing.finalize();
    timing.apply(response);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible listar los activos fijos.";

    const response = NextResponse.json({ error: message }, { status: 500 });
    timing.finalize();
    timing.apply(response);
    return response;
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
  if (!canAccess(permissions, session.Rol, "Administración", "Crear")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
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
        { error: "Faltan campos obligatorios para crear el activo fijo." },
        { status: 400 },
      );
    }

    await createActivoFijo({
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

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible crear el activo fijo.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
