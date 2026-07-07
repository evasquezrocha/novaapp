import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import {
  CT_SUPERVISORES_ESTADOS,
  canChangeCtSupervisoresEstado,
  canDeleteCtSupervisoresRow,
  canEditCtSupervisoresRow,
  canSeeCtSupervisoresRow,
  getNextCtSupervisoresCorrelativo,
  getCtSupervisoresRowById,
  listCtSupervisoresRowsByCorrelativo,
} from "@/lib/ct-supervisores-sql";
import {
  deleteCtSupervisoresByCorrelativoWithAudit,
  listCtSupervisoresHistoryRows,
  replaceCtSupervisoresRowsWithAudit,
} from "@/lib/ct-supervisores-audit-sql";

export const dynamic = "force-dynamic";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseChangesJson(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
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

  const { id: rawId } = await params;
  const id = parseId(rawId);

  if (!id) {
    return NextResponse.json({ error: "Id invalido." }, { status: 400 });
  }

  const existing = await getCtSupervisoresRowById(id);
  if (!existing) {
    return NextResponse.json({ error: "No se encontro el registro." }, { status: 404 });
  }

  if (!canSeeCtSupervisoresRow(session, existing)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const history = await listCtSupervisoresHistoryRows(existing.Correlativo);
    return NextResponse.json({
      row: existing,
      history: history.map((entry) => ({
        ...entry,
        Cambios: parseChangesJson(entry.CambiosJson),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible cargar el historial.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = parseId(rawId);

  if (!id) {
    return NextResponse.json({ error: "Id invalido." }, { status: 400 });
  }

  const existing = await getCtSupervisoresRowById(id);
  if (!existing) {
    return NextResponse.json({ error: "No se encontro el registro a editar." }, { status: 404 });
  }

  if (!canEditCtSupervisoresRow(session, existing)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      estado?: string;
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

    const estado = body.estado?.trim();
    if (!estado || !CT_SUPERVISORES_ESTADOS.includes(estado as (typeof CT_SUPERVISORES_ESTADOS)[number])) {
      return NextResponse.json({ error: "Estado es obligatorio." }, { status: 400 });
    }

    if (!canChangeCtSupervisoresEstado(session, existing, estado as (typeof CT_SUPERVISORES_ESTADOS)[number])) {
      return NextResponse.json(
        { error: "No puedes cambiar el estado de este registro." },
        { status: 403 },
      );
    }

    const normalizedRows = rows.map((row, index) => {
      const lugar = row.lugar?.trim();
      const entrada = row.entrada?.trim();
      const salida = row.salida?.trim();
      const dias = Number(row.dias);

      if (!lugar) {
        throw new Error(`La fila ${index + 1} requiere Lugar.`);
      }

      if (!entrada) {
        throw new Error(`La fila ${index + 1} requiere Entrada.`);
      }

      if (!salida) {
        throw new Error(`La fila ${index + 1} requiere Salida.`);
      }

      if (dias !== 0.25 && dias !== 1) {
        throw new Error(`La fila ${index + 1} requiere Dias valido.`);
      }

      return {
        Correlativo: existing.Correlativo,
        Estado: estado as (typeof CT_SUPERVISORES_ESTADOS)[number],
        Nombre: existing.Nombre,
        CreadoPorUsuario: existing.CreadoPorUsuario,
        CreadoPorNombre: existing.CreadoPorNombre,
        Lugar: lugar,
        Entrada: entrada,
        Salida: salida,
        Dias: dias as 0.25 | 1,
      };
    });

    await replaceCtSupervisoresRowsWithAudit(normalizedRows, session);
    const [affectedRows, nextCorrelativo] = await Promise.all([
      listCtSupervisoresRowsByCorrelativo(existing.Correlativo),
      getNextCtSupervisoresCorrelativo(),
    ]);

    return NextResponse.json({
      ok: true,
      replaced: normalizedRows.length,
      affectedRows,
      nextCorrelativo,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible actualizar el ingreso.";
    const status =
      message.includes("No se encontro el registro a editar.") ||
      message.includes("No se encontró el registro a editar.")
        ? 404
        : message.includes("obligatorio") ||
            message.includes("invalido") ||
            message.includes("inválido") ||
            message.includes("requiere") ||
            message.includes("Todas las filas")
          ? 400
          : 500;

    return NextResponse.json({ error: message }, { status });
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

  const { id: rawId } = await params;
  const id = parseId(rawId);

  if (!id) {
    return NextResponse.json({ error: "Id invalido." }, { status: 400 });
  }

  const existing = await getCtSupervisoresRowById(id);
  if (!existing) {
    return NextResponse.json({ error: "No se encontro el formulario a eliminar." }, { status: 404 });
  }

  if (!canDeleteCtSupervisoresRow(session, existing)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const deleted = await deleteCtSupervisoresByCorrelativoWithAudit(existing.Correlativo, session);
    const nextCorrelativo = await getNextCtSupervisoresCorrelativo();

    return NextResponse.json({
      ok: true,
      deleted,
      deletedCorrelativo: existing.Correlativo,
      nextCorrelativo,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible eliminar el formulario.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
