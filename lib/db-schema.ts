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

export async function ensureDatabaseSchema() {
  if (!global.__dbSchemaInit) {
    global.__dbSchemaInit = (async () => {
      const pool = await new sql.ConnectionPool(buildConfig()).connect();

      try {
        await runSqlFile(pool, "sql/create-usuarios-table.sql");
        await runSqlFile(pool, "sql/create-auth-tables.sql");
        await runSqlFile(pool, "sql/create-access-logs-table.sql");
        await runSqlFile(pool, "sql/create-permissions-table.sql");
      } finally {
        await pool.close();
      }
    })();
  }

  await global.__dbSchemaInit;
}
