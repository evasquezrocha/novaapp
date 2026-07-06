import sql from "mssql";
import { ensureDatabaseSchema } from "@/lib/db-schema";
import { getAuthPool } from "@/lib/auth-sql";
import { measureAsync } from "@/lib/server-performance";
import type { SessionUser } from "@/lib/auth-sql";

export type CtSupervisoresInput = {
  Correlativo: string;
  Estado: CtSupervisoresEstado;
  Nombre: string;
  Lugar: string;
  Entrada: string;
  Salida: string;
  Dias: 0.25 | 1;
  CreadoPorUsuario?: string;
  CreadoPorNombre?: string;
};

export type CtSupervisoresEstado =
  | "Ingresado"
  | "Rechazado"
  | "Aprobado Gerencia"
  | "Ingresado a Liquidación"
  | "Ingresado a Vacaciones";

export type CtSupervisoresRow = {
  Id: number;
  Correlativo: string;
  Estado: CtSupervisoresEstado;
  Nombre: string;
  CreadoPorUsuario: string;
  CreadoPorNombre: string;
  Lugar: string;
  Entrada: string;
  Salida: string;
  Dias: number;
  CreadoEn: string;
  ActualizadoEn: string;
};

export type CtSupervisoresAuditAction = "Creacion" | "Actualizacion" | "Eliminacion";

export type CtSupervisoresAuditChange = {
  row: number;
  field: string;
  before: string | null;
  after: string | null;
};

export type CtSupervisoresAuditPayload = {
  beforeRows: CtSupervisoresSnapshotRow[];
  afterRows: CtSupervisoresSnapshotRow[];
  changes: CtSupervisoresAuditChange[];
};

export type CtSupervisoresAuditRow = {
  Id: number;
  Correlativo: string;
  Accion: CtSupervisoresAuditAction;
  EditadoPorUsuario: string;
  EditadoPorNombre: string;
  EditadoPorRol: string;
  EditadoEn: string;
  CambiosJson: string;
};

type CtSupervisoresSnapshotRow = {
  Estado: CtSupervisoresEstado;
  Nombre: string;
  CreadoPorUsuario: string;
  CreadoPorNombre: string;
  Lugar: string;
  Entrada: string;
  Salida: string;
  Dias: 0.25 | 1;
};

export type CtSupervisoresActor = Pick<SessionUser, "Nombre" | "Usuario" | "Rol">;

export const CT_SUPERVISORES_PRIVILEGED_ROLES = ["Administrador", "RRHH", "Gerencia"] as const;
const CT_SUPERVISORES_STATE_LOCKED_FOR_GERENCIA = new Set<string>([
  "Ingresado a Vacaciones",
  "Ingresado a Liquidación",
] as const);

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeDateTime(value: string | null | undefined) {
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

function normalizeDias(value: unknown): 0.25 | 1 | null {
  return value === 0.25 || value === 1 ? value : null;
}

export const CT_SUPERVISORES_ESTADOS: CtSupervisoresEstado[] = [
  "Ingresado",
  "Rechazado",
  "Aprobado Gerencia",
  "Ingresado a Liquidación",
  "Ingresado a Vacaciones",
];

function normalizeEstado(value: string | null | undefined): CtSupervisoresEstado | null {
  const trimmed = value?.trim();
  return trimmed && CT_SUPERVISORES_ESTADOS.includes(trimmed as CtSupervisoresEstado)
    ? (trimmed as CtSupervisoresEstado)
    : null;
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

function escapeSqlString(value: string) {
  return value.replace(/'/g, "''");
}

function isPrivilegedCtSupervisoresRole(role: string) {
  return CT_SUPERVISORES_PRIVILEGED_ROLES.includes(
    role as (typeof CT_SUPERVISORES_PRIVILEGED_ROLES)[number],
  );
}

function isCtSupervisoresOwner(actor: CtSupervisoresActor, row: CtSupervisoresRow) {
  return (
    row.CreadoPorUsuario === actor.Usuario ||
    row.CreadoPorNombre === actor.Nombre ||
    row.Nombre === actor.Nombre
  );
}

export function canSeeCtSupervisoresRow(actor: CtSupervisoresActor, row: CtSupervisoresRow) {
  return isPrivilegedCtSupervisoresRole(actor.Rol) || isCtSupervisoresOwner(actor, row);
}

export function canEditCtSupervisoresRow(actor: CtSupervisoresActor, row: CtSupervisoresRow) {
  if (isPrivilegedCtSupervisoresRole(actor.Rol)) {
    return true;
  }

  return isCtSupervisoresOwner(actor, row) && row.Estado === "Ingresado";
}

export function canDeleteCtSupervisoresRow(actor: CtSupervisoresActor, row: CtSupervisoresRow) {
  return canEditCtSupervisoresRow(actor, row);
}

export function canChangeCtSupervisoresEstado(
  actor: CtSupervisoresActor,
  row: CtSupervisoresRow,
  nextEstado: CtSupervisoresEstado,
) {
  if (isPrivilegedCtSupervisoresRole(actor.Rol)) {
    if (actor.Rol === "Gerencia" && row.Estado !== nextEstado) {
      return !CT_SUPERVISORES_STATE_LOCKED_FOR_GERENCIA.has(row.Estado);
    }

    return true;
  }

  return isCtSupervisoresOwner(actor, row) && row.Estado === "Ingresado" && nextEstado === "Ingresado";
}

async function getPool() {
  await ensureDatabaseSchema();
  const pool = await getAuthPool();
  await ensureCtSupervisoresColumns(pool);
  return pool;
}

async function ensureCtSupervisoresColumns(pool: Awaited<ReturnType<typeof getAuthPool>>) {
  const hasCorrelativo = await pool
    .request()
    .query<{ Exists: number }>(`
      SELECT CASE WHEN COL_LENGTH('dbo.CtSupervisores', 'Correlativo') IS NULL THEN 0 ELSE 1 END AS [Exists]
    `);
  const hasEstado = await pool
    .request()
    .query<{ Exists: number }>(`
      SELECT CASE WHEN COL_LENGTH('dbo.CtSupervisores', 'Estado') IS NULL THEN 0 ELSE 1 END AS [Exists]
    `);

  if (!hasCorrelativo.recordset[0]?.Exists) {
    await pool.request().batch(`
      ALTER TABLE dbo.CtSupervisores
        ADD Correlativo NVARCHAR(50) NOT NULL CONSTRAINT DF_CtSupervisores_Correlativo DEFAULT ('');
    `);
  }

  if (!hasEstado.recordset[0]?.Exists) {
    await pool.request().batch(`
      ALTER TABLE dbo.CtSupervisores
        ADD Estado NVARCHAR(50) NOT NULL CONSTRAINT DF_CtSupervisores_Estado DEFAULT (N'Ingresado');
    `);
  }

  if (
    !(await pool.request().query<{ Exists: number }>(`
      SELECT CASE WHEN COL_LENGTH('dbo.CtSupervisores', 'CreadoPorUsuario') IS NULL THEN 0 ELSE 1 END AS [Exists]
    `)).recordset[0]?.Exists
  ) {
    await pool.request().batch(`
      ALTER TABLE dbo.CtSupervisores
        ADD CreadoPorUsuario NVARCHAR(100) NOT NULL CONSTRAINT DF_CtSupervisores_CreadoPorUsuario DEFAULT ('');
    `);
  }

  if (
    !(await pool.request().query<{ Exists: number }>(`
      SELECT CASE WHEN COL_LENGTH('dbo.CtSupervisores', 'CreadoPorNombre') IS NULL THEN 0 ELSE 1 END AS [Exists]
    `)).recordset[0]?.Exists
  ) {
    await pool.request().batch(`
      ALTER TABLE dbo.CtSupervisores
        ADD CreadoPorNombre NVARCHAR(150) NOT NULL CONSTRAINT DF_CtSupervisores_CreadoPorNombre DEFAULT ('');
    `);
  }

  await pool.request().batch(`
    UPDATE dbo.CtSupervisores
    SET Estado = N'Ingresado'
    WHERE Estado = N'Aprobado Supervisor';

    UPDATE dbo.CtSupervisores
    SET CreadoPorNombre = Nombre
    WHERE CreadoPorNombre = N'';
  `);
}

export async function listCtSupervisoresRows(actor: CtSupervisoresActor): Promise<CtSupervisoresRow[]> {
  return measureAsync(
    "ct-supervisores.list",
    async () => {
      const pool = await getPool();
      const isPrivileged = isPrivilegedCtSupervisoresRole(actor.Rol);
      const safeUsuario = escapeSqlString(actor.Usuario);
      const safeNombre = escapeSqlString(actor.Nombre);

      const result = await pool.request().query<CtSupervisoresRow>(`
        SELECT
          Id,
          Correlativo,
          Estado,
          Nombre,
          CreadoPorUsuario,
          CreadoPorNombre,
          Lugar,
          CONVERT(varchar(19), Entrada, 120) AS Entrada,
          CONVERT(varchar(19), Salida, 120) AS Salida,
          Dias,
          CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
          CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
        FROM dbo.CtSupervisores
        ${isPrivileged ? "" : `WHERE CreadoPorUsuario = N'${safeUsuario}' OR CreadoPorNombre = N'${safeNombre}'`}
        ORDER BY CreadoEn DESC, Id DESC
      `);

      return result.recordset;
    },
    {
      slowMs: 100,
    },
  );
}

export async function getCtSupervisoresRowById(id: number): Promise<CtSupervisoresRow | null> {
  const pool = await getPool();
  const result = await pool.request().query<CtSupervisoresRow>(`
    SELECT TOP (1)
      Id,
      Correlativo,
      Estado,
      Nombre,
      CreadoPorUsuario,
      CreadoPorNombre,
      Lugar,
      CONVERT(varchar(19), Entrada, 120) AS Entrada,
      CONVERT(varchar(19), Salida, 120) AS Salida,
      Dias,
      CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
      CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
    FROM dbo.CtSupervisores
    WHERE Id = ${Number(id)}
  `);

  return result.recordset[0] ?? null;
}

export async function listCtSupervisoresRowsByCorrelativo(
  correlativo: string,
): Promise<CtSupervisoresRow[]> {
  const pool = await getPool();
  const safeCorrelativo = requireText(normalizeText(correlativo), "Correlativo");
  const result = await pool.request().query<CtSupervisoresRow>(`
    SELECT
      Id,
      Correlativo,
      Estado,
      Nombre,
      CreadoPorUsuario,
      CreadoPorNombre,
      Lugar,
      CONVERT(varchar(19), Entrada, 120) AS Entrada,
      CONVERT(varchar(19), Salida, 120) AS Salida,
      Dias,
      CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
      CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
    FROM dbo.CtSupervisores
    WHERE Correlativo = N'${escapeSqlString(safeCorrelativo)}'
    ORDER BY Id ASC
  `);

  return result.recordset;
}

export async function listCtSupervisoresAuditRows(
  correlativo: string,
): Promise<CtSupervisoresAuditRow[]> {
  const pool = await getPool();
  const safeCorrelativo = requireText(normalizeText(correlativo), "Correlativo");
  const result = await pool.request().query<CtSupervisoresAuditRow>(`
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

export async function getNextCtSupervisoresCorrelativo(): Promise<string> {
  const pool = await getPool();
  const result = await pool.request().query<{ NextCorrelativo: number }>(`
    SELECT ISNULL(MAX(TRY_CONVERT(int, Correlativo)), 0) + 1 AS NextCorrelativo
    FROM dbo.CtSupervisores
    WHERE TRY_CONVERT(int, Correlativo) IS NOT NULL
  `);

  return String(result.recordset[0]?.NextCorrelativo ?? 1);
}

export async function createCtSupervisoresRows(input: CtSupervisoresInput[]) {
  const pool = await getPool();

  for (const row of input) {
    const correlativo = requireText(normalizeText(row.Correlativo), "Correlativo");
    const estado = requireText(normalizeEstado(row.Estado), "Estado");
    const nombre = requireText(normalizeText(row.Nombre), "Nombre");
    const creadoPorUsuario = normalizeText(row.CreadoPorUsuario) ?? "";
    const creadoPorNombre = normalizeText(row.CreadoPorNombre) ?? nombre;
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

    const safeCorrelativo = escapeSqlString(correlativo);
    const safeEstado = escapeSqlString(estado);
    const safeNombre = escapeSqlString(nombre);
    const safeCreadoPorUsuario = escapeSqlString(creadoPorUsuario);
    const safeCreadoPorNombre = escapeSqlString(creadoPorNombre);
    const safeLugar = escapeSqlString(lugar);

    await pool.request().query(`
      INSERT INTO dbo.CtSupervisores
        (Correlativo, Estado, Nombre, CreadoPorUsuario, CreadoPorNombre, Lugar, Entrada, Salida, Dias)
      VALUES
        (
          N'${safeCorrelativo}',
          N'${safeEstado}',
          N'${safeNombre}',
          N'${safeCreadoPorUsuario}',
          N'${safeCreadoPorNombre}',
          N'${safeLugar}',
          CONVERT(datetime2(0), N'${entradaSql}', 120),
          CONVERT(datetime2(0), N'${salidaSql}', 120),
          ${dias}
        )
    `);
  }
}

export async function replaceCtSupervisoresRows(input: CtSupervisoresInput[]) {
  if (input.length === 0) {
    throw new Error("Debes enviar al menos una fila.");
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  const correlativo = requireText(normalizeText(input[0].Correlativo), "Correlativo");

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
      const creadoPorUsuario = normalizeText(row.CreadoPorUsuario) ?? "";
      const creadoPorNombre = normalizeText(row.CreadoPorNombre) ?? nombre;
      const lugar = requireText(normalizeText(row.Lugar), "Lugar");
      const entrada = requireText(normalizeDateTime(row.Entrada), "Entrada");
      const salida = requireText(normalizeDateTime(row.Salida), "Salida");
      const dias = requireDias(normalizeDias(row.Dias));
      const entradaSql = formatDateTimeForSql(entrada);
      const salidaSql = formatDateTimeForSql(salida);

      if (!entradaSql) {
        throw new Error("Entrada tiene un formato invalido.");
      }

      if (!salidaSql) {
        throw new Error("Salida tiene un formato invalido.");
      }

      const safeCorrelativo = escapeSqlString(correlativo);
      const safeEstado = escapeSqlString(estado);
      const safeNombre = escapeSqlString(nombre);
      const safeCreadoPorUsuario = escapeSqlString(creadoPorUsuario);
      const safeCreadoPorNombre = escapeSqlString(creadoPorNombre);
      const safeLugar = escapeSqlString(lugar);

      await transaction.request().query(`
        INSERT INTO dbo.CtSupervisores
          (Correlativo, Estado, Nombre, CreadoPorUsuario, CreadoPorNombre, Lugar, Entrada, Salida, Dias)
        VALUES
          (
            N'${safeCorrelativo}',
            N'${safeEstado}',
            N'${safeNombre}',
            N'${safeCreadoPorUsuario}',
            N'${safeCreadoPorNombre}',
            N'${safeLugar}',
            CONVERT(datetime2(0), N'${entradaSql}', 120),
            CONVERT(datetime2(0), N'${salidaSql}', 120),
            ${dias}
          )
      `);
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function deleteCtSupervisoresByCorrelativo(correlativo: string) {
  const pool = await getPool();
  const safeCorrelativo = requireText(normalizeText(correlativo), "Correlativo");

  const result = await pool.request().query(`
    DELETE FROM dbo.CtSupervisores
    WHERE Correlativo = N'${escapeSqlString(safeCorrelativo)}'
  `);

  return result.rowsAffected[0] ?? 0;
}

export async function updateCtSupervisoresRow(input: CtSupervisoresInput & { Id: number }) {
  const pool = await getPool();
  const id = Number(input.Id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Id es obligatorio.");
  }

  const correlativo = requireText(normalizeText(input.Correlativo), "Correlativo");
  const estado = requireText(normalizeEstado(input.Estado), "Estado");
  const nombre = requireText(normalizeText(input.Nombre), "Nombre");
  const creadoPorUsuario = normalizeText(input.CreadoPorUsuario) ?? "";
  const creadoPorNombre = normalizeText(input.CreadoPorNombre) ?? nombre;
  const lugar = requireText(normalizeText(input.Lugar), "Lugar");
  const entrada = requireText(normalizeDateTime(input.Entrada), "Entrada");
  const salida = requireText(normalizeDateTime(input.Salida), "Salida");
  const dias = requireDias(normalizeDias(input.Dias));
  const entradaSql = formatDateTimeForSql(entrada);
  const salidaSql = formatDateTimeForSql(salida);

  if (!entradaSql) {
    throw new Error("Entrada tiene un formato inválido.");
  }

  if (!salidaSql) {
    throw new Error("Salida tiene un formato inválido.");
  }

  const safeCorrelativo = escapeSqlString(correlativo);
  const safeEstado = escapeSqlString(estado);
  const safeNombre = escapeSqlString(nombre);
  const safeCreadoPorUsuario = escapeSqlString(creadoPorUsuario);
  const safeCreadoPorNombre = escapeSqlString(creadoPorNombre);
  const safeLugar = escapeSqlString(lugar);

  const result = await pool.request().query(`
    UPDATE dbo.CtSupervisores
    SET
      Correlativo = N'${safeCorrelativo}',
      Estado = N'${safeEstado}',
      Nombre = N'${safeNombre}',
      CreadoPorUsuario = N'${safeCreadoPorUsuario}',
      CreadoPorNombre = N'${safeCreadoPorNombre}',
      Lugar = N'${safeLugar}',
      Entrada = CONVERT(datetime2(0), N'${entradaSql}', 120),
      Salida = CONVERT(datetime2(0), N'${salidaSql}', 120),
      Dias = ${dias},
      ActualizadoEn = SYSUTCDATETIME()
    WHERE Id = ${id}
  `);

  if (!(result.rowsAffected[0] ?? 0)) {
    throw new Error("No se encontró el registro a editar.");
  }
}
