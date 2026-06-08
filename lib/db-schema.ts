import fs from "node:fs/promises";
import path from "node:path";
import sql from "mssql";

type DbEnv = {
  user: string;
  password: string;
  server: string;
  port: number;
  database: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
  };
  pool: {
    max: number;
    min: number;
    idleTimeoutMillis: number;
  };
};

declare global {
  var __dbSchemaInit: Promise<void> | undefined;
  var __dbSchemaActivosFijosInit: Promise<void> | undefined;
}

function buildConfig(): DbEnv {
  const port = Number(process.env.SQL_PORT ?? "1433");

  if (!process.env.SQL_SERVER || !process.env.SQL_DATABASE) {
    throw new Error("Faltan variables de entorno para SQL_DATABASE.");
  }

  return {
    user: process.env.SQL_USER ?? "",
    password: process.env.SQL_PASSWORD ?? "",
    server: process.env.SQL_SERVER,
    port: Number.isFinite(port) ? port : 1433,
    database: process.env.SQL_DATABASE,
    options: {
      encrypt: process.env.SQL_ENCRYPT === "true",
      trustServerCertificate: process.env.SQL_TRUST_CERT === "true",
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

function splitSqlBatches(sqlText: string) {
  return sqlText
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((part) => part.trim())
    .filter(Boolean);
}

async function runSqlFile(pool: sql.ConnectionPool, relativePath: string) {
  const sqlText = await fs.readFile(path.join(process.cwd(), relativePath), "utf8");

  for (const batch of splitSqlBatches(sqlText)) {
    await pool.request().batch(batch);
  }
}

async function tableExists(pool: sql.ConnectionPool, tableName: string) {
  const result = await pool
    .request()
    .input("tableName", sql.NVarChar(256), tableName)
    .query<{ Exists: number }>(`
      SELECT CASE
        WHEN OBJECT_ID(@tableName, 'U') IS NULL THEN 0
        ELSE 1
      END AS [Exists]
    `);

  return Boolean(result.recordset[0]?.Exists);
}

export async function ensureDatabaseSchema() {
  if (!global.__dbSchemaInit) {
    global.__dbSchemaInit = (async () => {
      const pool = await new sql.ConnectionPool(buildConfig()).connect();

      try {
        const usuariosSql = await fs.readFile(
          path.join(process.cwd(), "sql/create-usuarios-table.sql"),
          "utf8",
        );
        for (const batch of splitSqlBatches(usuariosSql)) {
          await pool.request().batch(batch);
        }

        const authSql = await fs.readFile(
          path.join(process.cwd(), "sql/create-auth-tables.sql"),
          "utf8",
        );
        for (const batch of splitSqlBatches(authSql)) {
          await pool.request().batch(batch);
        }

        const accessLogsSql = await fs.readFile(
          path.join(process.cwd(), "sql/create-access-logs-table.sql"),
          "utf8",
        );
        for (const batch of splitSqlBatches(accessLogsSql)) {
          await pool.request().batch(batch);
        }

        const permissionsSql = await fs.readFile(
          path.join(process.cwd(), "sql/create-permissions-table.sql"),
          "utf8",
        );
        for (const batch of splitSqlBatches(permissionsSql)) {
          await pool.request().batch(batch);
        }
      } finally {
        await pool.close();
      }
    })();
  }

  await global.__dbSchemaInit;

  if (!global.__dbSchemaActivosFijosInit) {
    global.__dbSchemaActivosFijosInit = (async () => {
      const pool = await new sql.ConnectionPool(buildConfig()).connect();

      try {
        const hasActivosFijosTypes = await tableExists(pool, "dbo.ActivosFijosTipos");
        const hasActivosFijos = await tableExists(pool, "dbo.ActivosFijos");
        const hasActivosFijosMarcas = await tableExists(pool, "dbo.ActivosFijosMarcas");
        const hasActivosFijosGrupos = await tableExists(
          pool,
          "dbo.ActivosFijosGruposContables",
        );

        if (!hasActivosFijosTypes || !hasActivosFijos || !hasActivosFijosMarcas || !hasActivosFijosGrupos) {
          await runSqlFile(pool, "sql/create-activos-fijos-table.sql");
        }
      } finally {
        await pool.close();
      }
    })();
  }

  await global.__dbSchemaActivosFijosInit;
}
