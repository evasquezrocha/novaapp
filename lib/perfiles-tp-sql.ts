import { randomBytes } from "node:crypto";
import sql from "mssql";
import { ensureDatabaseSchema } from "@/lib/db-schema";
import { getAuthPool } from "@/lib/auth-sql";
import { measureAsync } from "@/lib/server-performance";

const globalForPerfilesTp = globalThis as typeof globalThis & {
  __dbPerfilesTpInit?: Promise<void>;
};

export type PerfilTpInput = {
  Empresa: string;
  Logo: string | null;
  Nombre: string;
  Contacto: string | null;
  WhatsApp: string | null;
  Telefono: string | null;
  Web: string | null;
  Instagram: string | null;
  LinkedIn: string | null;
  Transferencia: string | null;
  CodigoAleatorio: string;
};

export type PerfilTpRow = PerfilTpInput & {
  Id: number;
  CreadoEn: string;
  ActualizadoEn: string;
};

export type PerfilTpSummaryRow = Pick<PerfilTpRow, "Id" | "Empresa" | "Nombre" | "CodigoAleatorio">;

export type PerfilTpPublicRow = Pick<
  PerfilTpRow,
  | "Empresa"
  | "Logo"
  | "Nombre"
  | "Contacto"
  | "WhatsApp"
  | "Telefono"
  | "Web"
  | "Instagram"
  | "LinkedIn"
  | "Transferencia"
  | "CodigoAleatorio"
>;

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requireText(value: string | null, fieldName: string) {
  if (!value) {
    throw new Error(`${fieldName} es obligatorio.`);
  }

  return value;
}

export function generatePerfilTpCodigoAleatorio() {
  return randomBytes(4).toString("hex");
}

async function getPool() {
  await ensurePerfilesTpReady();
  return getAuthPool();
}

async function ensurePerfilesTpReady() {
  if (!globalForPerfilesTp.__dbPerfilesTpInit) {
    globalForPerfilesTp.__dbPerfilesTpInit = (async () => {
      await ensureDatabaseSchema();
      const pool = await getAuthPool();
      await ensurePerfilTpColumns(pool);
    })().catch((error) => {
      globalForPerfilesTp.__dbPerfilesTpInit = undefined;
      throw error;
    });
  }

  await globalForPerfilesTp.__dbPerfilesTpInit;
}

async function ensurePerfilTpColumns(pool: Awaited<ReturnType<typeof getAuthPool>>) {
  if (!(await tableExists(pool, "dbo.PerfilesTP"))) {
    return;
  }

  const columns = [
    ["Empresa", "NVARCHAR(MAX) NULL"],
    ["Logo", "NVARCHAR(MAX) NULL"],
    ["Nombre", "NVARCHAR(MAX) NULL"],
    ["Contacto", "NVARCHAR(MAX) NULL"],
    ["WhatsApp", "NVARCHAR(MAX) NULL"],
    ["Telefono", "NVARCHAR(MAX) NULL"],
    ["Web", "NVARCHAR(MAX) NULL"],
    ["Instagram", "NVARCHAR(MAX) NULL"],
    ["LinkedIn", "NVARCHAR(MAX) NULL"],
    ["Transferencia", "NVARCHAR(MAX) NULL"],
    ["CodigoAleatorio", "NVARCHAR(50) NULL"],
  ] as const;

  for (const [column, definition] of columns) {
    const exists = await pool.request().query<{ Exists: number }>(`
      SELECT CASE WHEN COL_LENGTH('dbo.PerfilesTP', '${column}') IS NULL THEN 0 ELSE 1 END AS [Exists]
    `);

    if (!exists.recordset[0]?.Exists) {
      await pool.request().batch(`
        ALTER TABLE dbo.PerfilesTP
          ADD ${column} ${definition};
      `);
    }
  }

  const rowsWithEmptyCode = await pool.request().query<{ Id: number }>(`
    SELECT Id
    FROM dbo.PerfilesTP
    WHERE CodigoAleatorio IS NULL OR LTRIM(RTRIM(CodigoAleatorio)) = N''
  `);

  for (const row of rowsWithEmptyCode.recordset) {
    let code = generatePerfilTpCodigoAleatorio();
    let attempts = 0;

    while (attempts < 10) {
      const safeCode = code.replace(/'/g, "''");
      const collision = await pool.request().query<{ Exists: number }>(`
        SELECT CASE WHEN EXISTS (
          SELECT 1 FROM dbo.PerfilesTP WHERE CodigoAleatorio = N'${safeCode}'
        ) THEN 1 ELSE 0 END AS [Exists]
      `);

      if (!collision.recordset[0]?.Exists) {
        break;
      }

      code = generatePerfilTpCodigoAleatorio();
      attempts += 1;
    }

    const safeCode = code.replace(/'/g, "''");
    await pool.request().query(`
      UPDATE dbo.PerfilesTP
      SET CodigoAleatorio = N'${safeCode}'
      WHERE Id = ${row.Id}
    `);
  }

  const hasUniqueIndex = await pool
    .request()
    .query<{ Exists: number }>(`
      SELECT CASE WHEN EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.PerfilesTP')
          AND name = 'UX_PerfilesTP_CodigoAleatorio'
      ) THEN 1 ELSE 0 END AS [Exists]
    `);

  if (!hasUniqueIndex.recordset[0]?.Exists) {
    await pool.request().batch(`
      CREATE UNIQUE INDEX UX_PerfilesTP_CodigoAleatorio
        ON dbo.PerfilesTP(CodigoAleatorio);
    `);
  }
}

async function tableExists(pool: sql.ConnectionPool, tableName: string) {
  const safeTableName = tableName.replace(/'/g, "''");
  const result = await pool
    .request()
    .query<{ Exists: number }>(`
      SELECT CASE
        WHEN OBJECT_ID(N'${safeTableName}', 'U') IS NULL THEN 0
        ELSE 1
      END AS [Exists]
    `);

  return Boolean(result.recordset[0]?.Exists);
}

function buildAdminSelect() {
  return `
    SELECT
      Id,
      Empresa,
      Logo,
      Nombre,
      Contacto,
      WhatsApp,
      Telefono,
      Web,
      Instagram,
      LinkedIn,
      Transferencia,
      CodigoAleatorio,
      CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
      CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
    FROM dbo.PerfilesTP
  `;
}

function buildSummarySelect() {
  return `
    SELECT
      Id,
      Empresa,
      Nombre,
      CodigoAleatorio
    FROM dbo.PerfilesTP
  `;
}

function buildPublicProfileSelect() {
  return `
    SELECT
      Empresa,
      Logo,
      Nombre,
      Contacto,
      WhatsApp,
      Telefono,
      Web,
      Instagram,
      LinkedIn,
      Transferencia,
      CodigoAleatorio
    FROM dbo.PerfilesTP
  `;
}

export async function listPerfilTpRows(): Promise<PerfilTpRow[]> {
  return measureAsync("perfiles-tp.list", async () => {
    const pool = await getPool();
    const result = await pool.request().query<PerfilTpRow>(`
      ${buildAdminSelect()}
      ORDER BY CreadoEn DESC, Id DESC
    `);

    return result.recordset;
  });
}

export async function listPerfilTpPublicRows(): Promise<PerfilTpSummaryRow[]> {
  return measureAsync("perfiles-tp.list-public", async () => {
    const pool = await getPool();
    const result = await pool.request().query<PerfilTpSummaryRow>(`
      ${buildSummarySelect()}
      ORDER BY CreadoEn DESC, Id DESC
    `);

    return result.recordset;
  });
}

export async function getPerfilTpRowById(id: number): Promise<PerfilTpRow | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query<PerfilTpRow>(`
      ${buildAdminSelect()}
      WHERE Id = @id
    `);

  return result.recordset[0] ?? null;
}

export async function getPerfilTpRowByCodigo(codigoAleatorio: string): Promise<PerfilTpRow | null> {
  const pool = await getPool();
  const safeCodigo = codigoAleatorio.trim().replace(/'/g, "''");
  const result = await pool.request().query<PerfilTpRow>(`
      ${buildAdminSelect()}
      WHERE CodigoAleatorio = N'${safeCodigo}'
    `);

  return result.recordset[0] ?? null;
}

export async function getPerfilTpPublicRowByCodigo(
  codigoAleatorio: string,
): Promise<PerfilTpPublicRow | null> {
  const pool = await getPool();
  const safeCodigo = codigoAleatorio.trim().replace(/'/g, "''");
  const result = await pool.request().query<PerfilTpPublicRow>(`
      ${buildPublicProfileSelect()}
      WHERE CodigoAleatorio = N'${safeCodigo}'
    `);

  return result.recordset[0] ?? null;
}

export async function createPerfilTpRows(input: PerfilTpInput[]) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    for (const row of input) {
      const empresa = requireText(normalizeText(row.Empresa), "Empresa");
      const nombre = requireText(normalizeText(row.Nombre), "Nombre");
      const codigoAleatorio = normalizeText(row.CodigoAleatorio) ?? generatePerfilTpCodigoAleatorio();

      await transaction
        .request()
        .input("empresa", sql.NVarChar(sql.MAX), empresa)
        .input("logo", sql.NVarChar(sql.MAX), normalizeText(row.Logo))
        .input("nombre", sql.NVarChar(sql.MAX), nombre)
        .input("contacto", sql.NVarChar(sql.MAX), normalizeText(row.Contacto))
        .input("whatsapp", sql.NVarChar(sql.MAX), normalizeText(row.WhatsApp))
        .input("telefono", sql.NVarChar(sql.MAX), normalizeText(row.Telefono))
        .input("web", sql.NVarChar(sql.MAX), normalizeText(row.Web))
        .input("instagram", sql.NVarChar(sql.MAX), normalizeText(row.Instagram))
        .input("linkedin", sql.NVarChar(sql.MAX), normalizeText(row.LinkedIn))
        .input("transferencia", sql.NVarChar(sql.MAX), normalizeText(row.Transferencia))
        .input("codigo", sql.NVarChar(50), codigoAleatorio)
        .query(`
          INSERT INTO dbo.PerfilesTP
            (Empresa, Logo, Nombre, Contacto, WhatsApp, Telefono, Web, Instagram, LinkedIn, Transferencia, CodigoAleatorio)
          VALUES
            (@empresa, @logo, @nombre, @contacto, @whatsapp, @telefono, @web, @instagram, @linkedin, @transferencia, @codigo)
        `);
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updatePerfilTpRow(input: PerfilTpInput & { Id: number }) {
  const pool = await getPool();
  const id = Number(input.Id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Id es obligatorio.");
  }

  const empresa = requireText(normalizeText(input.Empresa), "Empresa");
  const nombre = requireText(normalizeText(input.Nombre), "Nombre");
  const codigoAleatorio = requireText(normalizeText(input.CodigoAleatorio), "Codigo Aleatorio");

  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("empresa", sql.NVarChar(sql.MAX), empresa)
    .input("logo", sql.NVarChar(sql.MAX), normalizeText(input.Logo))
    .input("nombre", sql.NVarChar(sql.MAX), nombre)
    .input("contacto", sql.NVarChar(sql.MAX), normalizeText(input.Contacto))
    .input("whatsapp", sql.NVarChar(sql.MAX), normalizeText(input.WhatsApp))
    .input("telefono", sql.NVarChar(sql.MAX), normalizeText(input.Telefono))
    .input("web", sql.NVarChar(sql.MAX), normalizeText(input.Web))
    .input("instagram", sql.NVarChar(sql.MAX), normalizeText(input.Instagram))
    .input("linkedin", sql.NVarChar(sql.MAX), normalizeText(input.LinkedIn))
    .input("transferencia", sql.NVarChar(sql.MAX), normalizeText(input.Transferencia))
    .input("codigo", sql.NVarChar(50), codigoAleatorio)
    .query(`
      UPDATE dbo.PerfilesTP
      SET
        Empresa = @empresa,
        Logo = @logo,
        Nombre = @nombre,
        Contacto = @contacto,
        WhatsApp = @whatsapp,
        Telefono = @telefono,
        Web = @web,
        Instagram = @instagram,
        LinkedIn = @linkedin,
        Transferencia = @transferencia,
        CodigoAleatorio = @codigo,
        ActualizadoEn = SYSUTCDATETIME()
      WHERE Id = @id
    `);

  if (!(result.rowsAffected[0] ?? 0)) {
    throw new Error("No se encontro el perfil a editar.");
  }
}

export async function updatePerfilTpRowPartial(
  id: number,
  input: Partial<PerfilTpInput>,
) {
  const pool = await getPool();
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error("Id es obligatorio.");
  }

  const setParts: string[] = [];
  const request = pool.request().input("id", sql.Int, numericId);

  const registerText = (column: keyof PerfilTpInput, value: string | null | undefined, type = sql.NVarChar(sql.MAX)) => {
    if (value === undefined) {
      return;
    }

    const paramName = String(column).toLowerCase();
    request.input(paramName, type, normalizeText(value));
    setParts.push(`${String(column)} = @${paramName}`);
  };

  registerText("Empresa", input.Empresa, sql.NVarChar(sql.MAX));
  registerText("Logo", input.Logo, sql.NVarChar(sql.MAX));
  registerText("Nombre", input.Nombre, sql.NVarChar(sql.MAX));
  registerText("Contacto", input.Contacto, sql.NVarChar(sql.MAX));
  registerText("WhatsApp", input.WhatsApp, sql.NVarChar(sql.MAX));
  registerText("Telefono", input.Telefono, sql.NVarChar(sql.MAX));
  registerText("Web", input.Web, sql.NVarChar(sql.MAX));
  registerText("Instagram", input.Instagram, sql.NVarChar(sql.MAX));
  registerText("LinkedIn", input.LinkedIn, sql.NVarChar(sql.MAX));
  registerText("Transferencia", input.Transferencia, sql.NVarChar(sql.MAX));
  registerText("CodigoAleatorio", input.CodigoAleatorio, sql.NVarChar(50));

  if (setParts.length === 0) {
    return;
  }

  const result = await request.query(`
    UPDATE dbo.PerfilesTP
    SET ${setParts.join(", ")},
        ActualizadoEn = SYSUTCDATETIME()
    WHERE Id = @id
  `);

  if (!(result.rowsAffected[0] ?? 0)) {
    throw new Error("No se encontro el perfil a editar.");
  }
}

export async function deletePerfilTpRow(id: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`
      DELETE FROM dbo.PerfilesTP
      WHERE Id = @id
    `);

  return result.rowsAffected[0] ?? 0;
}
