import sql from "mssql";
import { revalidateTag, unstable_cache } from "next/cache";
import { pbkdf2, randomBytes } from "node:crypto";
import { ensureDatabaseSchema } from "@/lib/db-schema";
import {
  DEFAULT_CACHE_REVALIDATE_SECONDS,
  PLATFORM_CACHE_TAGS,
} from "@/lib/platform-cache";

export type UsuarioRow = {
  Id: number;
  Nombre: string;
  Usuario: string;
  Correo: string;
  Rol: string;
  Activo: boolean;
  CreadoEn: string;
  ActualizadoEn: string;
};

export type UsuarioLoginRow = {
  Id: number;
  Nombre: string;
  Usuario: string;
  Rol: string;
  Activo: boolean;
  PasswordSalt: Buffer;
  PasswordHash: Buffer;
};

type UsuariosEnv = {
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
  var __usuariosPool: Promise<sql.ConnectionPool> | undefined;
}

function buildConfig(): UsuariosEnv {
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

async function getPool() {
  await ensureDatabaseSchema();

  if (!global.__usuariosPool) {
    global.__usuariosPool = sql.connect(buildConfig());
  }

  return global.__usuariosPool;
}

function normalizeUsuarioRow(row: UsuarioRow): UsuarioRow {
  return {
    ...row,
    Activo: Boolean(row.Activo),
  };
}

function isMissingObjectError(error: unknown) {
  return (
    error instanceof Error &&
    "number" in error &&
    typeof (error as { number?: unknown }).number === "number" &&
    (error as { number: number }).number === 208
  );
}

function escapeSqlString(value: string) {
  return value.replace(/'/g, "''");
}

function toSqlHex(buffer: Buffer) {
  return `0x${buffer.toString("hex")}`;
}

const listUsuariosCached = unstable_cache(
  async () => {
    const pool = await getPool();
    const result = await pool
      .request()
      .query<UsuarioRow>(`
        SELECT
          Id,
          Nombre,
          Usuario,
          Correo,
          Rol,
          Activo,
          CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
          CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
        FROM dbo.Usuarios
        ORDER BY Nombre ASC, Id DESC
      `);

    return result.recordset.map(normalizeUsuarioRow);
  },
  ["platform", "usuarios"],
  {
    tags: [PLATFORM_CACHE_TAGS.usuarios],
    revalidate: DEFAULT_CACHE_REVALIDATE_SECONDS,
  },
);

export async function listUsuarios(): Promise<UsuarioRow[]> {
  try {
    return await listUsuariosCached();
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw error;
    }

    global.__usuariosPool = undefined;
    await ensureDatabaseSchema();

    return await listUsuariosCached();
  }
}

export async function findUsuarioForLoginByUsuario(
  usuario: string,
): Promise<UsuarioLoginRow | null> {
  const query = async () => {
    const pool = await getPool();
    return pool
      .request()
      .input("usuario", usuario)
      .query<UsuarioLoginRow>(`
        SELECT
          Id,
          Nombre,
          Usuario,
          Rol,
          Activo,
          PasswordSalt,
          PasswordHash
        FROM dbo.Usuarios
        WHERE Usuario = @usuario
      `);
  };

  try {
    const result = await query();
    const row = result.recordset[0];
    if (!row) {
      return null;
    }

    return {
      ...row,
      Activo: Boolean(row.Activo),
    };
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw error;
    }

    global.__usuariosPool = undefined;
    await ensureDatabaseSchema();

    const result = await query();
    const row = result.recordset[0];
    if (!row) {
      return null;
    }

    return {
      ...row,
      Activo: Boolean(row.Activo),
    };
  }
}

export async function getUsuarioById(id: number): Promise<UsuarioRow | null> {
  const query = async () => {
    const pool = await getPool();
    return pool.request().query<UsuarioRow>(`
      SELECT
        Id,
        Nombre,
        Usuario,
        Correo,
        Rol,
        Activo,
        CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
        CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
      FROM dbo.Usuarios
      WHERE Id = ${id}
    `);
  };

  try {
    const result = await query();
    return result.recordset[0] ? normalizeUsuarioRow(result.recordset[0]) : null;
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw error;
    }

    global.__usuariosPool = undefined;
    await ensureDatabaseSchema();

    const result = await query();
    return result.recordset[0] ? normalizeUsuarioRow(result.recordset[0]) : null;
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(32);
  const hash = await new Promise<Buffer>((resolve, reject) => {
    pbkdf2(password, salt, 310000, 64, "sha512", (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });

  return { salt, hash };
}

export async function createUsuario(input: {
  nombre: string;
  usuario: string;
  correo: string;
  rol: string;
  activo: boolean;
  password: string;
}) {
  const run = async () => {
    const pool = await getPool();
    const { salt, hash } = await hashPassword(input.password);
    const nombre = escapeSqlString(input.nombre);
    const usuario = escapeSqlString(input.usuario);
    const correo = escapeSqlString(input.correo);
    const rol = escapeSqlString(input.rol);

    await pool
      .request()
      .query(`
        INSERT INTO dbo.Usuarios
          (Nombre, Usuario, Correo, Rol, Activo, PasswordSalt, PasswordHash)
        VALUES
          (N'${nombre}', N'${usuario}', N'${correo}', N'${rol}', ${input.activo ? 1 : 0}, ${toSqlHex(salt)}, ${toSqlHex(hash)})
      `);
  };

  try {
    await run();
    revalidateTag(PLATFORM_CACHE_TAGS.usuarios, "max");
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw error;
    }

    global.__usuariosPool = undefined;
    await ensureDatabaseSchema();
    await run();
  }
}

export async function updateUsuario(input: {
  id: number;
  nombre: string;
  usuario: string;
  correo: string;
  rol: string;
  activo: boolean;
  password?: string;
}) {
  const run = async () => {
    const pool = await getPool();
    const nombre = escapeSqlString(input.nombre);
    const usuario = escapeSqlString(input.usuario);
    const correo = escapeSqlString(input.correo);
    const rol = escapeSqlString(input.rol);
    let query = `
      UPDATE dbo.Usuarios
      SET
        Nombre = N'${nombre}',
        Usuario = N'${usuario}',
        Correo = N'${correo}',
        Rol = N'${rol}',
        Activo = ${input.activo ? 1 : 0},
        ActualizadoEn = SYSUTCDATETIME()
      WHERE Id = ${input.id}
    `;

    if (input.password?.trim().length) {
      const { salt, hash } = await hashPassword(input.password);
      query = `
        UPDATE dbo.Usuarios
        SET
          Nombre = N'${nombre}',
          Usuario = N'${usuario}',
          Correo = N'${correo}',
          Rol = N'${rol}',
          Activo = ${input.activo ? 1 : 0},
          PasswordSalt = ${toSqlHex(salt)},
          PasswordHash = ${toSqlHex(hash)},
          ActualizadoEn = SYSUTCDATETIME()
        WHERE Id = ${input.id}
      `;
    }

    await pool.request().query(query);
  };

  try {
    await run();
    revalidateTag(PLATFORM_CACHE_TAGS.usuarios, "max");
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw error;
    }

    global.__usuariosPool = undefined;
    await ensureDatabaseSchema();
    await run();
  }
}

export async function updateUsuarioPassword(input: {
  id: number;
  password: string;
}) {
  const run = async () => {
    const pool = await getPool();
    const { salt, hash } = await hashPassword(input.password);

    await pool.request().query(`
      UPDATE dbo.Usuarios
      SET
        PasswordSalt = ${toSqlHex(salt)},
        PasswordHash = ${toSqlHex(hash)},
        ActualizadoEn = SYSUTCDATETIME()
      WHERE Id = ${input.id}
    `);
  };

  try {
    await run();
    revalidateTag(PLATFORM_CACHE_TAGS.usuarios, "max");
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw error;
    }

    global.__usuariosPool = undefined;
    await ensureDatabaseSchema();
    await run();
  }
}

export async function deleteUsuario(id: number) {
  const run = async () => {
    const pool = await getPool();
    await pool.request().query(`
      DELETE FROM dbo.Usuarios
      WHERE Id = ${id}
    `);
  };

  try {
    await run();
    revalidateTag(PLATFORM_CACHE_TAGS.usuarios, "max");
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw error;
    }

    global.__usuariosPool = undefined;
    await ensureDatabaseSchema();
    await run();
  }
}
