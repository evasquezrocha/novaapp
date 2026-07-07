import sql from "mssql";
import { revalidateTag } from "next/cache";
import { ensureDatabaseSchema } from "@/lib/db-schema";
import { getAuthPool } from "@/lib/auth-sql";
import {
  insertCtSupervisoresRows,
  listCtSupervisoresRowsByCorrelativo,
  type CtSupervisoresActor,
  type CtSupervisoresAuditRow,
  type CtSupervisoresEstado,
  type CtSupervisoresInput,
  type CtSupervisoresRow,
} from "@/lib/ct-supervisores-sql";
import { PLATFORM_CACHE_TAGS } from "@/lib/platform-cache";

type SnapshotRow = {
  Estado: CtSupervisoresEstado;
  Nombre: string;
  CreadoPorUsuario: string;
  CreadoPorNombre: string;
  Lugar: string;
  OTN: string;
  Entrada: string;
  Salida: string;
  Dias: 0.25 | 1;
};

type AuditPayload = {
  beforeRows: SnapshotRow[];
  afterRows: SnapshotRow[];
  changes: Array<{
    row: number;
    field: string;
    before: string | null;
    after: string | null;
  }>;
};

export type CtSupervisoresHistoryRow = CtSupervisoresAuditRow;

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function escapeSqlString(value: string) {
  return value.replace(/'/g, "''");
}

function snapshotFromInput(row: CtSupervisoresInput): SnapshotRow {
  return {
    Estado: row.Estado,
    Nombre: row.Nombre,
    CreadoPorUsuario: row.CreadoPorUsuario ?? "",
    CreadoPorNombre: row.CreadoPorNombre ?? row.Nombre,
    Lugar: row.Lugar,
    OTN: row.OTN,
    Entrada: row.Entrada,
    Salida: row.Salida,
    Dias: row.Dias,
  };
}

function snapshotFromDbRow(row: CtSupervisoresRow): SnapshotRow {
  return {
    Estado: row.Estado,
    Nombre: row.Nombre,
    CreadoPorUsuario: row.CreadoPorUsuario,
    CreadoPorNombre: row.CreadoPorNombre,
    Lugar: row.Lugar,
    OTN: row.OTN,
    Entrada: row.Entrada,
    Salida: row.Salida,
    Dias: row.Dias as 0.25 | 1,
  };
}

function describeSnapshotRow(row: SnapshotRow) {
  return [
    `Estado=${row.Estado}`,
    `Nombre=${row.Nombre}`,
    `Lugar=${row.Lugar}`,
    `OTN=${row.OTN}`,
    `Entrada=${row.Entrada}`,
    `Salida=${row.Salida}`,
    `Dias=${row.Dias}`,
  ].join(" | ");
}

function buildAuditPayload(beforeRows: SnapshotRow[], afterRows: SnapshotRow[]): AuditPayload {
  const changes: AuditPayload["changes"] = [];
  const maxRows = Math.max(beforeRows.length, afterRows.length);

  for (let index = 0; index < maxRows; index += 1) {
    const beforeRow = beforeRows[index] ?? null;
    const afterRow = afterRows[index] ?? null;

    if (!beforeRow && afterRow) {
      changes.push({
        row: index + 1,
        field: "Fila",
        before: null,
        after: describeSnapshotRow(afterRow),
      });
      continue;
    }

    if (beforeRow && !afterRow) {
      changes.push({
        row: index + 1,
        field: "Fila",
        before: describeSnapshotRow(beforeRow),
        after: null,
      });
      continue;
    }

    if (!beforeRow || !afterRow) {
      continue;
    }

    for (const field of ["Estado", "Nombre", "Lugar", "OTN", "Entrada", "Salida", "Dias"] as const) {
      const beforeValue = String(beforeRow[field]);
      const afterValue = String(afterRow[field]);

      if (beforeValue !== afterValue) {
        changes.push({
          row: index + 1,
          field,
          before: beforeValue,
          after: afterValue,
        });
      }
    }
  }

  return { beforeRows, afterRows, changes };
}

async function getPool() {
  await ensureDatabaseSchema();
  return getAuthPool();
}

async function writeAuditRecord(
  transaction: sql.Transaction,
  payload: {
    correlativo: string;
    action: "Creacion" | "Actualizacion" | "Eliminacion";
    actor: CtSupervisoresActor;
    changes: AuditPayload;
  },
) {
  await transaction
    .request()
    .input("correlativo", sql.NVarChar(50), payload.correlativo)
    .input("accion", sql.NVarChar(20), payload.action)
    .input("usuario", sql.NVarChar(100), payload.actor.Usuario)
    .input("nombre", sql.NVarChar(150), payload.actor.Nombre)
    .input("rol", sql.NVarChar(50), payload.actor.Rol)
    .input("cambiosJson", sql.NVarChar(sql.MAX), JSON.stringify(payload.changes))
    .query(`
      INSERT INTO dbo.CtSupervisoresHistorial
        (Correlativo, Accion, EditadoPorUsuario, EditadoPorNombre, EditadoPorRol, CambiosJson, EditadoEn)
      VALUES
        (@correlativo, @accion, @usuario, @nombre, @rol, @cambiosJson, SYSUTCDATETIME())
    `);
}

function requireText(value: string | null, fieldName: string) {
  if (!value) {
    throw new Error(`${fieldName} es obligatorio.`);
  }

  return value;
}

export async function listCtSupervisoresHistoryRows(
  correlativo: string,
): Promise<CtSupervisoresHistoryRow[]> {
  const pool = await getPool();
  const safeCorrelativo = requireText(normalizeText(correlativo), "Correlativo");
  const result = await pool.request().query<CtSupervisoresHistoryRow>(`
    SELECT
      Id,
      Correlativo,
      Accion,
      EditadoPorUsuario,
      EditadoPorNombre,
      EditadoPorRol,
      CONVERT(varchar(19), EditadoEn, 120) AS EditadoEn,
      CambiosJson
    FROM dbo.CtSupervisoresHistorial
    WHERE Correlativo = N'${escapeSqlString(safeCorrelativo)}'
    ORDER BY EditadoEn DESC, Id DESC
  `);

  return result.recordset;
}

export async function createCtSupervisoresRowsWithAudit(
  input: CtSupervisoresInput[],
  actor: CtSupervisoresActor,
) {
  if (input.length === 0) {
    throw new Error("Debes enviar al menos una fila.");
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  const correlativo = requireText(normalizeText(input[0].Correlativo), "Correlativo");
  const afterRows = input.map(snapshotFromInput);

  await transaction.begin();

  try {
    await insertCtSupervisoresRows(transaction, input, actor);

    await writeAuditRecord(transaction, {
      correlativo,
      action: "Creacion",
      actor,
      changes: buildAuditPayload([], afterRows),
    });

    await transaction.commit();
    revalidateTag(PLATFORM_CACHE_TAGS.ctSupervisores, "max");
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function replaceCtSupervisoresRowsWithAudit(
  input: CtSupervisoresInput[],
  actor: CtSupervisoresActor,
) {
  if (input.length === 0) {
    throw new Error("Debes enviar al menos una fila.");
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  const correlativo = requireText(normalizeText(input[0].Correlativo), "Correlativo");
  const beforeRows = await listCtSupervisoresRowsByCorrelativo(correlativo);
  const afterRows = input.map(snapshotFromInput);

  for (const row of input) {
    const currentCorrelativo = requireText(normalizeText(row.Correlativo), "Correlativo");
    if (currentCorrelativo !== correlativo) {
      throw new Error("Todas las filas deben tener el mismo Correlativo.");
    }
  }

  await transaction.begin();

  try {
    await transaction
      .request()
      .input("correlativo", sql.NVarChar(50), correlativo)
      .query(`
        DELETE FROM dbo.CtSupervisores
        WHERE Correlativo = @correlativo
      `);

    await insertCtSupervisoresRows(transaction, input, actor);

    await writeAuditRecord(transaction, {
      correlativo,
      action: "Actualizacion",
      actor,
      changes: buildAuditPayload(beforeRows.map(snapshotFromDbRow), afterRows),
    });

    await transaction.commit();
    revalidateTag(PLATFORM_CACHE_TAGS.ctSupervisores, "max");
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function deleteCtSupervisoresByCorrelativoWithAudit(
  correlativo: string,
  actor: CtSupervisoresActor,
) {
  const pool = await getPool();
  const safeCorrelativo = requireText(normalizeText(correlativo), "Correlativo");
  const beforeRows = await listCtSupervisoresRowsByCorrelativo(safeCorrelativo);
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const result = await transaction
      .request()
      .input("correlativo", sql.NVarChar(50), safeCorrelativo)
      .query(`
        DELETE FROM dbo.CtSupervisores
        WHERE Correlativo = @correlativo
      `);

    await writeAuditRecord(transaction, {
      correlativo: safeCorrelativo,
      action: "Eliminacion",
      actor,
      changes: buildAuditPayload(beforeRows.map(snapshotFromDbRow), []),
    });

    await transaction.commit();
    revalidateTag(PLATFORM_CACHE_TAGS.ctSupervisores, "max");
    return result.rowsAffected[0] ?? 0;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
