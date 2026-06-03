import fs from "node:fs";
import path from "node:path";
import sql from "mssql";

function loadEnv(filePath) {
  const envText = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const root = process.cwd();
const env = loadEnv(path.join(root, ".env.local"));
const config = {
  user: env.SQL_USER ?? "",
  password: env.SQL_PASSWORD ?? "",
  server: env.SQL_SERVER,
  port: Number(env.SQL_PORT ?? 1433),
  database: env.SQL_DATABASE,
  options: {
    encrypt: env.SQL_ENCRYPT === "true",
    trustServerCertificate: env.SQL_TRUST_CERT === "true",
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

if (!config.server || !config.database) {
  throw new Error("Faltan variables de conexión en .env.local");
}

const sqlText = fs.readFileSync(
  path.join(root, "sql", "update-admin-password.sql"),
  "utf8",
);

function splitSqlBatches(sqlTextInput) {
  return sqlTextInput
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((part) => part.trim())
    .filter(Boolean);
}

const pool = await sql.connect(config);
try {
  for (const batch of splitSqlBatches(sqlText)) {
    await pool.request().batch(batch);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        updatedUser: "evasquezrocha",
      },
      null,
      2,
    ),
  );
} finally {
  await pool.close();
}
