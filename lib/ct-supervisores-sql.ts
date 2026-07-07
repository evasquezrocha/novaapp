import sql from "mssql";
import { revalidateTag, unstable_cache } from "next/cache";
import { ensureDatabaseSchema } from "@/lib/db-schema";
import { getAuthPool } from "@/lib/auth-sql";
import { measureAsync } from "@/lib/server-performance";
import type { SessionUser } from "@/lib/auth-sql";
import { DEFAULT_CACHE_REVALIDATE_SECONDS, PLATFORM_CACHE_TAGS } from "@/lib/platform-cache";

export type CtSupervisoresInput = {
  Correlativo: string;
  Estado: CtSupervisoresEstado;
  Nombre: string;
  Lugar: string;
  OTN: string;
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
  OTN: string;
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
  OTN: string;
  Entrada: string;
  Salida: string;
  Dias: 0.25 | 1;
};

export type CtSupervisoresActor = Pick<SessionUser, "Nombre" | "Usuario" | "Rol">;

type CtSupervisoresNormalizedInput = {
  Correlativo: string;
  Estado: CtSupervisoresEstado;
  Nombre: string;
  CreadoPorUsuario: string;
  CreadoPorNombre: string;
  Lugar: string;
  OTN: string;
  EntradaSql: string;
  SalidaSql: string;
  Dias: 0.25 | 1;
};

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

function actorCacheKey(actor: CtSupervisoresActor) {
  return `${actor.Rol}::${actor.Usuario}::${actor.Nombre}`;
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
  return getAuthPool();
}

export function normalizeCtSupervisoresInput(
  row: CtSupervisoresInput,
  actorDefaults?: Pick<CtSupervisoresActor, "Usuario" | "Nombre">,
): CtSupervisoresNormalizedInput {
  const correlativo = requireText(normalizeText(row.Correlativo), "Correlativo");
  const estado = requireText(normalizeEstado(row.Estado), "Estado");
  const nombre = requireText(normalizeText(row.Nombre), "Nombre");
  const creadoPorUsuario = normalizeText(row.CreadoPorUsuario) ?? actorDefaults?.Usuario ?? "";
  const creadoPorNombre = normalizeText(row.CreadoPorNombre) ?? actorDefaults?.Nombre ?? nombre;
  const lugar = requireText(normalizeText(row.Lugar), "Lugar");
  const otn = requireText(normalizeText(row.OTN), "OTN");
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

  return {
    Correlativo: correlativo,
    Estado: estado as CtSupervisoresEstado,
    Nombre: nombre,
    CreadoPorUsuario: creadoPorUsuario,
    CreadoPorNombre: creadoPorNombre,
    Lugar: lugar,
    OTN: otn,
    EntradaSql: entradaSql,
    SalidaSql: salidaSql,
    Dias: dias,
  };
}

export async function insertCtSupervisoresRows(
  executor: sql.ConnectionPool | sql.Transaction,
  input: CtSupervisoresInput[],
  actorDefaults?: Pick<CtSupervisoresActor, "Usuario" | "Nombre">,
) {
  if (input.length === 0) {
    return;
  }

  const normalizedRows = input.map((row) => normalizeCtSupervisoresInput(row, actorDefaults));
  const request = executor.request();
  const values: string[] = [];

  for (const [index, row] of normalizedRows.entries()) {
    request.input(`correlativo${index}`, sql.NVarChar(50), row.Correlativo);
    request.input(`estado${index}`, sql.NVarChar(50), row.Estado);
    request.input(`nombre${index}`, sql.NVarChar(150), row.Nombre);
    request.input(`creadoPorUsuario${index}`, sql.NVarChar(100), row.CreadoPorUsuario);
    request.input(`creadoPorNombre${index}`, sql.NVarChar(150), row.CreadoPorNombre);
    request.input(`lugar${index}`, sql.NVarChar(150), row.Lugar);
    request.input(`otn${index}`, sql.NVarChar(50), row.OTN);
    request.input(`entrada${index}`, sql.DateTime2(0), row.EntradaSql);
    request.input(`salida${index}`, sql.DateTime2(0), row.SalidaSql);
    request.input(`dias${index}`, sql.Decimal(4, 2), row.Dias);

    values.push(`(
      @correlativo${index},
      @estado${index},
      @nombre${index},
      @creadoPorUsuario${index},
      @creadoPorNombre${index},
      @lugar${index},
      @otn${index},
      @entrada${index},
      @salida${index},
      @dias${index}
    )`);
  }

  await request.query(`
    INSERT INTO dbo.CtSupervisores
      (Correlativo, Estado, Nombre, CreadoPorUsuario, CreadoPorNombre, Lugar, OTN, Entrada, Salida, Dias)
    VALUES
      ${values.join(",\n")}
  `);
}

const listCtSupervisoresRowsCached = unstable_cache(
  async (actorKey: string, role: string, usuario: string, nombre: string) => {
    return measureAsync(
      "ct-supervisores.list",
      async () => {
        const pool = await getPool();
        const isPrivileged = isPrivilegedCtSupervisoresRole(role);
        const safeUsuario = escapeSqlString(usuario);
        const safeNombre = escapeSqlString(nombre);

        const result = await pool.request().query<CtSupervisoresRow>(`
          SELECT
            Id,
            Correlativo,
            Estado,
            Nombre,
            CreadoPorUsuario,
            CreadoPorNombre,
            Lugar,
            OTN,
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
  },
  ["platform", "ct-supervisores", "list"],
  {
    tags: [PLATFORM_CACHE_TAGS.ctSupervisores],
    revalidate: DEFAULT_CACHE_REVALIDATE_SECONDS,
  },
);

export async function listCtSupervisoresRows(actor: CtSupervisoresActor): Promise<CtSupervisoresRow[]> {
  return listCtSupervisoresRowsCached(actorCacheKey(actor), actor.Rol, actor.Usuario, actor.Nombre);
}

const getCtSupervisoresRowByIdCached = unstable_cache(
  async (id: number) => {
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
        OTN,
        CONVERT(varchar(19), Entrada, 120) AS Entrada,
        CONVERT(varchar(19), Salida, 120) AS Salida,
        Dias,
        CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
        CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
      FROM dbo.CtSupervisores
      WHERE Id = ${Number(id)}
    `);

    return result.recordset[0] ?? null;
  },
  ["platform", "ct-supervisores", "by-id"],
  {
    tags: [PLATFORM_CACHE_TAGS.ctSupervisores],
    revalidate: DEFAULT_CACHE_REVALIDATE_SECONDS,
  },
);

export async function getCtSupervisoresRowById(id: number): Promise<CtSupervisoresRow | null> {
  return getCtSupervisoresRowByIdCached(id);
}

const listCtSupervisoresRowsByCorrelativoCached = unstable_cache(
  async (correlativo: string) => {
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
        OTN,
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
  },
  ["platform", "ct-supervisores", "by-correlativo"],
  {
    tags: [PLATFORM_CACHE_TAGS.ctSupervisores],
    revalidate: DEFAULT_CACHE_REVALIDATE_SECONDS,
  },
);

export async function listCtSupervisoresRowsByCorrelativo(
  correlativo: string,
): Promise<CtSupervisoresRow[]> {
  return listCtSupervisoresRowsByCorrelativoCached(correlativo);
}

const listCtSupervisoresAuditRowsCached = unstable_cache(
  async (correlativo: string) => {
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
  },
  ["platform", "ct-supervisores", "audit-by-correlativo"],
  {
    tags: [PLATFORM_CACHE_TAGS.ctSupervisores],
    revalidate: DEFAULT_CACHE_REVALIDATE_SECONDS,
  },
);

export async function listCtSupervisoresAuditRows(
  correlativo: string,
): Promise<CtSupervisoresAuditRow[]> {
  return listCtSupervisoresAuditRowsCached(correlativo);
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
    const otn = requireText(normalizeText(row.OTN), "OTN");
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
    const safeOtn = escapeSqlString(otn);

    await pool.request().query(`
      INSERT INTO dbo.CtSupervisores
        (Correlativo, Estado, Nombre, CreadoPorUsuario, CreadoPorNombre, Lugar, OTN, Entrada, Salida, Dias)
      VALUES
        (
          N'${safeCorrelativo}',
          N'${safeEstado}',
          N'${safeNombre}',
          N'${safeCreadoPorUsuario}',
          N'${safeCreadoPorNombre}',
          N'${safeLugar}',
          N'${safeOtn}',
          CONVERT(datetime2(0), N'${entradaSql}', 120),
          CONVERT(datetime2(0), N'${salidaSql}', 120),
          ${dias}
        )
    `);
  }

  revalidateTag(PLATFORM_CACHE_TAGS.ctSupervisores, "max");
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
      const otn = requireText(normalizeText(row.OTN), "OTN");
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
      const safeOtn = escapeSqlString(otn);

      await transaction.request().query(`
        INSERT INTO dbo.CtSupervisores
          (Correlativo, Estado, Nombre, CreadoPorUsuario, CreadoPorNombre, Lugar, OTN, Entrada, Salida, Dias)
        VALUES
          (
            N'${safeCorrelativo}',
            N'${safeEstado}',
            N'${safeNombre}',
            N'${safeCreadoPorUsuario}',
            N'${safeCreadoPorNombre}',
            N'${safeLugar}',
            N'${safeOtn}',
            CONVERT(datetime2(0), N'${entradaSql}', 120),
            CONVERT(datetime2(0), N'${salidaSql}', 120),
            ${dias}
          )
      `);
    }

    await transaction.commit();
    revalidateTag(PLATFORM_CACHE_TAGS.ctSupervisores, "max");
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

  if ((result.rowsAffected[0] ?? 0) > 0) {
    revalidateTag(PLATFORM_CACHE_TAGS.ctSupervisores, "max");
  }

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
  const otn = requireText(normalizeText(input.OTN), "OTN");
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
  const safeOtn = escapeSqlString(otn);

  const result = await pool.request().query(`
    UPDATE dbo.CtSupervisores
    SET
      Correlativo = N'${safeCorrelativo}',
      Estado = N'${safeEstado}',
      Nombre = N'${safeNombre}',
      CreadoPorUsuario = N'${safeCreadoPorUsuario}',
      CreadoPorNombre = N'${safeCreadoPorNombre}',
      Lugar = N'${safeLugar}',
      OTN = N'${safeOtn}',
      Entrada = CONVERT(datetime2(0), N'${entradaSql}', 120),
      Salida = CONVERT(datetime2(0), N'${salidaSql}', 120),
      Dias = ${dias},
      ActualizadoEn = SYSUTCDATETIME()
    WHERE Id = ${id}
  `);

  if (!(result.rowsAffected[0] ?? 0)) {
    throw new Error("No se encontró el registro a editar.");
  }

  revalidateTag(PLATFORM_CACHE_TAGS.ctSupervisores, "max");
}
