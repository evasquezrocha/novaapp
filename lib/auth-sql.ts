import sql from "mssql";
import { createHash, randomBytes, pbkdf2, timingSafeEqual } from "node:crypto";
import { ensureDatabaseSchema } from "@/lib/db-schema";
import { findUsuarioForLoginByUsuario } from "@/lib/usuarios-sql";

export type SessionUser = {
  Id: number;
  Nombre: string;
  Usuario: string;
  Rol: string;
};

export type AccessLogRow = {
  Id: number;
  UsuarioId: number;
  Usuario: string;
  Nombre: string;
  DireccionIp: string | null;
  AccedidoEn: string;
};

type AuthEnv = {
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

const SESSION_DAYS = 7;
export const AUTH_COOKIE_NAME = "nova_session";

declare global {
  var __authPool: Promise<sql.ConnectionPool> | undefined;
}

function buildConfig(): AuthEnv {
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

export async function getAuthPool() {
  await ensureDatabaseSchema();

  if (!global.__authPool) {
    global.__authPool = sql.connect(buildConfig());
  }

  return global.__authPool;
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

export async function verifyPassword(
  password: string,
  salt: Buffer,
  expectedHash: Buffer,
) {
  const hash = await new Promise<Buffer>((resolve, reject) => {
    pbkdf2(password, salt, 310000, expectedHash.length, "sha512", (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });

  return hash.length === expectedHash.length && timingSafeEqual(hash, expectedHash);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest();
}

function isMissingObjectError(error: unknown) {
  return (
    error instanceof Error &&
    "number" in error &&
    typeof (error as { number?: unknown }).number === "number" &&
    (error as { number: number }).number === 208
  );
}

export async function authenticateUser(usuario: string, password: string) {
  const user = await findUsuarioForLoginByUsuario(usuario);

  if (!user || !user.Activo) {
    return null;
  }

  const valid = await verifyPassword(password, user.PasswordSalt, user.PasswordHash);
  if (!valid) {
    return null;
  }

  return {
    Id: user.Id,
    Nombre: user.Nombre,
    Usuario: user.Usuario,
    Rol: user.Rol,
  } satisfies SessionUser;
}

export async function createSession(user: SessionUser) {
  const run = async () => {
    const pool = await getAuthPool();
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);

    await pool
      .request()
      .input("tokenHash", tokenHash)
      .input("usuarioId", sql.Int, user.Id)
      .query(`
        INSERT INTO dbo.Sesiones
          (TokenHash, UsuarioId, ExpiraEn, UltimoAccesoEn)
        VALUES
          (@tokenHash, @usuarioId, DATEADD(DAY, ${SESSION_DAYS}, SYSUTCDATETIME()), SYSUTCDATETIME())
      `);

    return {
      token,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
    };
  };

  try {
    return await run();
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw error;
    }

    global.__authPool = undefined;
    await ensureDatabaseSchema();
    return await run();
  }
}

export async function getSessionUserByToken(token: string) {
  const query = async () => {
    const pool = await getAuthPool();
    const tokenHash = hashToken(token);

    return pool
      .request()
      .input("tokenHash", tokenHash)
      .query<SessionUser>(`
        SELECT
          U.Id,
          U.Nombre,
          U.Usuario,
          U.Rol
        FROM dbo.Sesiones S
        INNER JOIN dbo.Usuarios U
          ON U.Id = S.UsuarioId
        WHERE S.TokenHash = @tokenHash
          AND S.RevocadoEn IS NULL
          AND S.ExpiraEn > SYSUTCDATETIME()
          AND U.Activo = 1
      `);
  };

  try {
    const result = await query();
    return result.recordset[0] ?? null;
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw error;
    }

    global.__authPool = undefined;
    await ensureDatabaseSchema();

    const result = await query();
    return result.recordset[0] ?? null;
  }
}

export async function revokeSession(token: string) {
  const run = async () => {
    const pool = await getAuthPool();
    const tokenHash = hashToken(token);

    await pool
      .request()
      .input("tokenHash", tokenHash)
      .query(`
        UPDATE dbo.Sesiones
        SET RevocadoEn = SYSUTCDATETIME()
        WHERE TokenHash = @tokenHash
      `);
  };

  try {
    await run();
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw error;
    }

    global.__authPool = undefined;
    await ensureDatabaseSchema();
    await run();
  }
}

export async function recordAccessLog(user: SessionUser, ipAddress: string | null) {
  const run = async () => {
    const pool = await getAuthPool();

    await pool
      .request()
      .input("usuarioId", sql.Int, user.Id)
      .input("usuario", sql.NVarChar(80), user.Usuario)
      .input("nombre", sql.NVarChar(150), user.Nombre)
      .input("direccionIp", sql.NVarChar(45), ipAddress)
      .query(`
        INSERT INTO dbo.AccesosLog
          (UsuarioId, Usuario, Nombre, DireccionIp)
        VALUES
          (@usuarioId, @usuario, @nombre, @direccionIp)
      `);
  };

  try {
    await run();
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw error;
    }

    global.__authPool = undefined;
    await ensureDatabaseSchema();
    await run();
  }
}

export async function listAccessLogs(top = 50): Promise<AccessLogRow[]> {
  const query = async () => {
    const pool = await getAuthPool();
    const safeTop = Math.max(1, Math.min(500, Math.trunc(top) || 50));

    return pool
      .request()
      .query<AccessLogRow>(`
        SELECT TOP (${safeTop})
          Id,
          UsuarioId,
          Usuario,
          Nombre,
          DireccionIp,
          CONVERT(varchar(19), AccedidoEn, 120) AS AccedidoEn
        FROM dbo.AccesosLog
        ORDER BY AccedidoEn DESC, Id DESC
      `);
  };

  try {
    const result = await query();
    return result.recordset;
  } catch (error) {
    if (!isMissingObjectError(error)) {
      throw error;
    }

    global.__authPool = undefined;
    await ensureDatabaseSchema();

    const result = await query();
    return result.recordset;
  }
}
