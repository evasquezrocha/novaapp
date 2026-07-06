import sql from "mssql";
import { ensureDatabaseSchema } from "@/lib/db-schema";
import { getAuthPool } from "@/lib/auth-sql";
import {
  CT_SUPERVISORES_ESTADOS,
  listCtSupervisoresRowsByCorrelativo,
  type CtSupervisoresActor,
  type CtSupervisoresAuditRow,
  type CtSupervisoresEstado,
  type CtSupervisoresInput,
  type CtSupervisoresRow,
} from "@/lib/ct-supervisores-sql";

type SnapshotRow = {
  Estado: CtSupervisoresEstado;
  Nombre: string;
  CreadoPorUsuario: string;
  CreadoPorNombre: string;
  Lugar: string;
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

function formatDateTimeForSql(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second = "00"] = match;
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
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

    for (const field of ["Estado", "Nombre", "Lugar", "Entrada", "Salida", "Dias"] as const) {
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

function requireDias(value: 0.25 | 1 | null) {
  if (value === null) {
    throw new Error("Dias es obligatorio.");
  }

  return value;
}

function normalizeDateTime(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeDias(value: unknown): 0.25 | 1 | null {
  return value === 0.25 || value === 1 ? value : null;
}

function normalizeEstado(value: string | null | undefined): CtSupervisoresEstado | null {
  const trimmed = value?.trim();
  return trimmed && CT_SUPERVISORES_ESTADOS.includes(trimmed as CtSupervisoresEstado)
    ? (trimmed as CtSupervisoresEstado)
    : null;
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
    for (const row of input) {
      const rowCorrelativo = requireText(normalizeText(row.Correlativo), "Correlativo");
      const estado = requireText(normalizeEstado(row.Estado), "Estado");
      const nombre = requireText(normalizeText(row.Nombre), "Nombre");
      const creadoPorUsuario = normalizeText(row.CreadoPorUsuario) ?? actor.Usuario;
      const creadoPorNombre = normalizeText(row.CreadoPorNombre) ?? actor.Nombre;
      const lugar = requireText(normalizeText(row.Lugar), "Lugar");
      const entrada = requireText(normalizeDateTime(row.Entrada), "Entrada");
      const salida = requireText(normalizeDateTime(row.Salida), "Salida");
      const dias = requireDias(normalizeDias(row.Dias));
      const entradaSql = formatDateTimeForSql(entrada);
      const salidaSql = formatDateTimeForSql(salida);

      if (!entradaSql) {
        throw new Error("Entrada tiene un formato inválido.");
      }

      if (!salidaSql) {
        throw new Error("Salida tiene un formato inválido.");
      }

      await transaction.request().query(`
        INSERT INTO dbo.CtSupervisores
          (Correlativo, Estado, Nombre, CreadoPorUsuario, CreadoPorNombre, Lugar, Entrada, Salida, Dias)
        VALUES
          (
            N'${escapeSqlString(rowCorrelativo)}',
            N'${escapeSqlString(estado)}',
            N'${escapeSqlString(nombre)}',
            N'${escapeSqlString(creadoPorUsuario)}',
            N'${escapeSqlString(creadoPorNombre)}',
            N'${escapeSqlString(lugar)}',
            CONVERT(datetime2(0), N'${entradaSql}', 120),
            CONVERT(datetime2(0), N'${salidaSql}', 120),
            ${dias}
          )
      `);
    }

    await writeAuditRecord(transaction, {
      correlativo,
      action: "Creacion",
      actor,
      changes: buildAuditPayload([], afterRows),
    });

    await transaction.commit();
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

    for (const row of input) {
      const estado = requireText(normalizeEstado(row.Estado), "Estado");
      const nombre = requireText(normalizeText(row.Nombre), "Nombre");
      const creadoPorUsuario = normalizeText(row.CreadoPorUsuario) ?? actor.Usuario;
      const creadoPorNombre = normalizeText(row.CreadoPorNombre) ?? actor.Nombre;
      const lugar = requireText(normalizeText(row.Lugar), "Lugar");
      const entrada = requireText(normalizeDateTime(row.Entrada), "Entrada");
      const salida = requireText(normalizeDateTime(row.Salida), "Salida");
      const dias = requireDias(normalizeDias(row.Dias));
      const entradaSql = formatDateTimeForSql(entrada);
      const salidaSql = formatDateTimeForSql(salida);

      if (!entradaSql) {
        throw new Error("Entrada tiene un formato inválido.");
      }

      if (!salidaSql) {
        throw new Error("Salida tiene un formato inválido.");
      }

      await transaction.request().query(`
        INSERT INTO dbo.CtSupervisores
          (Correlativo, Estado, Nombre, CreadoPorUsuario, CreadoPorNombre, Lugar, Entrada, Salida, Dias)
        VALUES
          (
            N'${escapeSqlString(correlativo)}',
            N'${escapeSqlString(estado)}',
            N'${escapeSqlString(nombre)}',
            N'${escapeSqlString(creadoPorUsuario)}',
            N'${escapeSqlString(creadoPorNombre)}',
            N'${escapeSqlString(lugar)}',
            CONVERT(datetime2(0), N'${entradaSql}', 120),
            CONVERT(datetime2(0), N'${salidaSql}', 120),
            ${dias}
          )
      `);
    }

    await writeAuditRecord(transaction, {
      correlativo,
      action: "Actualizacion",
      actor,
      changes: buildAuditPayload(beforeRows.map(snapshotFromDbRow), afterRows),
    });

    await transaction.commit();
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
    const result = await transaction.request().query(`
      DELETE FROM dbo.CtSupervisores
      WHERE Correlativo = N'${escapeSqlString(safeCorrelativo)}'
    `);

    await writeAuditRecord(transaction, {
      correlativo: safeCorrelativo,
      action: "Eliminacion",
      actor,
      changes: buildAuditPayload(beforeRows.map(snapshotFromDbRow), []),
    });

    await transaction.commit();
    return result.rowsAffected[0] ?? 0;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
