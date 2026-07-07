import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import {
  CT_SUPERVISORES_ESTADOS,
  getNextCtSupervisoresCorrelativo,
  listCtSupervisoresRows,
  listCtSupervisoresRowsByCorrelativo,
} from "@/lib/ct-supervisores-sql";
import { createCtSupervisoresRowsWithAudit } from "@/lib/ct-supervisores-audit-sql";

export const dynamic = "force-dynamic";

class ValidationError extends Error {}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Asistencia")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const [rows, nextCorrelativo] = await Promise.all([
      listCtSupervisoresRows(session),
      getNextCtSupervisoresCorrelativo(),
    ]);
    return NextResponse.json({ rows, nextCorrelativo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible listar los ingresos.";
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
  if (!canAccess(permissions, session.Rol, "Asistencia")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      correlativo?: string;
      estado?: string;
      nombre?: string;
      rows?: Array<{
        lugar?: string;
        entrada?: string;
        salida?: string;
        dias?: 0.25 | 1 | string | number;
      }>;
    };

    const rows = body.rows ?? [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Debes enviar al menos una fila." }, { status: 400 });
    }

    const correlativo = body.correlativo?.trim();
    const estado = body.estado?.trim();

    if (!correlativo) {
      throw new ValidationError("Correlativo es obligatorio.");
    }

    const allowedStates = new Set(CT_SUPERVISORES_ESTADOS);

    if (!estado || !allowedStates.has(estado as (typeof CT_SUPERVISORES_ESTADOS)[number])) {
      throw new ValidationError("Estado es obligatorio.");
    }

    const normalizedRows = rows.map((row, index) => {
      const lugar = row.lugar?.trim();
      const entrada = row.entrada?.trim();
      const salida = row.salida?.trim();
      const dias = Number(row.dias);

      if (!lugar) {
        throw new ValidationError(`La fila ${index + 1} requiere Lugar.`);
      }

      if (!entrada) {
        throw new ValidationError(`La fila ${index + 1} requiere Entrada.`);
      }

      if (!salida) {
        throw new ValidationError(`La fila ${index + 1} requiere Salida.`);
      }

      if (dias !== 0.25 && dias !== 1) {
        throw new ValidationError(`La fila ${index + 1} requiere Dias valido.`);
      }

      return {
        Correlativo: correlativo,
        Estado: estado as (typeof CT_SUPERVISORES_ESTADOS)[number],
        Nombre: body.nombre?.trim() || session.Nombre,
        CreadoPorUsuario: session.Usuario,
        CreadoPorNombre: session.Nombre,
        Lugar: lugar,
        Entrada: entrada,
        Salida: salida,
        Dias: dias as 0.25 | 1,
      };
    });

    await createCtSupervisoresRowsWithAudit(normalizedRows, session);

    const [affectedRows, nextCorrelativo] = await Promise.all([
      listCtSupervisoresRowsByCorrelativo(correlativo),
      getNextCtSupervisoresCorrelativo(),
    ]);

    return NextResponse.json(
      { ok: true, created: normalizedRows.length, affectedRows, nextCorrelativo },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible guardar el ingreso.";
    const status = error instanceof ValidationError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
