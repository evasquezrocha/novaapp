import sql from "mssql";
import { createHash, randomBytes, pbkdf2, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { ensureDatabaseSchema } from "@/lib/db-schema";
import { measureAsync } from "@/lib/server-performance";
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
const LOGIN_ATTEMPT_THRESHOLD = 5;
const LOGIN_ATTEMPT_WINDOW_MINUTES = 15;
const LOGIN_LOCK_MINUTES = 15;

type LoginAttemptRow = {
  IntentosFallidos: number;
  PrimeraFallaEn: string | Date | null;
  BloqueadoHasta: string | Date | null;
};

declare global {
  var __authPool: Promise<sql.ConnectionPool> | undefined;
}

function buildConfig(): AuthEnv {
  const port = Number(process.env.SQL_PORT ?? "1433");
  const poolMax = Number(process.env.SQL_POOL_MAX ?? "20");
  const poolMin = Number(process.env.SQL_POOL_MIN ?? "0");
  const poolIdleTimeoutMillis = Number(process.env.SQL_POOL_IDLE_TIMEOUT_MS ?? "30000");

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
      max: Number.isFinite(poolMax) ? poolMax : 20,
      min: Number.isFinite(poolMin) ? poolMin : 0,
      idleTimeoutMillis: Number.isFinite(poolIdleTimeoutMillis)
        ? poolIdleTimeoutMillis
        : 30000,
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

function toSqlHex(buffer: Buffer) {
  return `0x${buffer.toString("hex")}`;
}

function normalizeLoginKey(value: string) {
  return value.trim();
}

function normalizeIpAddress(ipAddress: string | null) {
  return ipAddress?.trim() || "";
}

function isBlockedUntil(blockedUntil: string | Date | null) {
  if (!blockedUntil) {
    return false;
  }

  return new Date(blockedUntil).getTime() > Date.now();
}

function getRetryAfterSeconds(blockedUntil: string | Date) {
  return Math.max(1, Math.ceil((new Date(blockedUntil).getTime() - Date.now()) / 1000));
}

function isWithinWindow(firstFailureAt: string | Date, now: Date) {
  const first = new Date(firstFailureAt).getTime();
  return now.getTime() - first <= LOGIN_ATTEMPT_WINDOW_MINUTES * 60 * 1000;
}

async function getLoginAttemptRow(usuario: string, ipAddress: string | null) {
  const pool = await getAuthPool();
  const result = await pool
    .request()
    .input("usuario", normalizeLoginKey(usuario))
    .input("ipAddress", normalizeIpAddress(ipAddress))
    .query<LoginAttemptRow>(`
      SELECT
        IntentosFallidos,
        PrimeraFallaEn,
        BloqueadoHasta
      FROM dbo.LoginIntentos
      WHERE Usuario = @usuario
        AND DireccionIp = @ipAddress
    `);

  return result.recordset[0] ?? null;
}

export async function getLoginAttemptBlock(usuario: string, ipAddress: string | null) {
  const row = await getLoginAttemptRow(usuario, ipAddress);
  if (!row || !isBlockedUntil(row.BloqueadoHasta)) {
    return null;
  }

  return {
    blockedUntil: new Date(row.BloqueadoHasta as string | Date),
    retryAfterSeconds: getRetryAfterSeconds(row.BloqueadoHasta as string | Date),
  };
}

export async function recordFailedLoginAttempt(usuario: string, ipAddress: string | null) {
  const pool = await getAuthPool();
  const normalizedUsuario = normalizeLoginKey(usuario);
  const normalizedIp = normalizeIpAddress(ipAddress);
  const now = new Date();
  const row = await getLoginAttemptRow(normalizedUsuario, normalizedIp);

  if (!row) {
    const blockedUntil =
      LOGIN_ATTEMPT_THRESHOLD <= 1
        ? new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60 * 1000)
        : null;

    await pool
      .request()
      .input("usuario", normalizedUsuario)
      .input("ipAddress", normalizedIp)
      .input("now", sql.DateTime2, now)
      .input("blockedUntil", sql.DateTime2, blockedUntil)
      .query(`
        INSERT INTO dbo.LoginIntentos
          (Usuario, DireccionIp, IntentosFallidos, PrimeraFallaEn, UltimaFallaEn, BloqueadoHasta, CreadoEn, ActualizadoEn)
        VALUES
          (@usuario, @ipAddress, 1, @now, @now, @blockedUntil, @now, @now)
      `);

    return {
      attempts: 1,
      blockedUntil,
      retryAfterSeconds: blockedUntil ? getRetryAfterSeconds(blockedUntil) : undefined,
    };
  }

  const withinWindow = row.PrimeraFallaEn ? isWithinWindow(row.PrimeraFallaEn, now) : false;
  const attempts = withinWindow ? row.IntentosFallidos + 1 : 1;
  const blockedUntil =
    attempts >= LOGIN_ATTEMPT_THRESHOLD
      ? new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60 * 1000)
      : null;

  await pool
    .request()
    .input("usuario", sql.NVarChar(100), normalizedUsuario)
    .input("ipAddress", sql.NVarChar(45), normalizedIp)
    .input("now", sql.DateTime2, now)
    .input("attempts", sql.Int, attempts)
    .input("blockedUntil", sql.DateTime2, blockedUntil)
    .query(`
      UPDATE dbo.LoginIntentos
      SET
        IntentosFallidos = @attempts,
        PrimeraFallaEn = CASE WHEN @attempts = 1 THEN @now ELSE PrimeraFallaEn END,
        UltimaFallaEn = @now,
        BloqueadoHasta = @blockedUntil,
        ActualizadoEn = @now
      WHERE Usuario = @usuario
        AND DireccionIp = @ipAddress
    `);

  return {
    attempts,
    blockedUntil,
    retryAfterSeconds: blockedUntil ? getRetryAfterSeconds(blockedUntil) : undefined,
  };
}

export async function clearLoginAttempts(usuario: string, ipAddress: string | null) {
  const pool = await getAuthPool();
  const normalizedUsuario = normalizeLoginKey(usuario);
  const normalizedIp = normalizeIpAddress(ipAddress);

  await pool
    .request()
    .input("usuario", normalizedUsuario)
    .input("ipAddress", normalizedIp)
    .query(`
      DELETE FROM dbo.LoginIntentos
      WHERE Usuario = @usuario
        AND DireccionIp = @ipAddress
    `);
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
  const pool = await getAuthPool();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);

  await pool
    .request()
    .query(`
      INSERT INTO dbo.Sesiones
        (TokenHash, UsuarioId, ExpiraEn, UltimoAccesoEn)
      VALUES
        (${toSqlHex(tokenHash)}, ${user.Id}, DATEADD(DAY, ${SESSION_DAYS}, SYSUTCDATETIME()), SYSUTCDATETIME())
    `);

  return {
    token,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
  };
}

async function getSessionUserByTokenUncached(token: string) {
  const query = async () => {
    const pool = await getAuthPool();
    const tokenHash = hashToken(token);

    return pool
      .request()
      .query<SessionUser>(`
        SELECT
          U.Id,
          U.Nombre,
          U.Usuario,
          U.Rol
        FROM dbo.Sesiones S
        INNER JOIN dbo.Usuarios U
          ON U.Id = S.UsuarioId
        WHERE S.TokenHash = ${toSqlHex(tokenHash)}
          AND S.RevocadoEn IS NULL
          AND S.ExpiraEn > SYSUTCDATETIME()
          AND U.Activo = 1
      `);
  };

  const result = await measureAsync("auth.getSessionUserByToken", query, {
    slowMs: 100,
  });
  return result.recordset[0] ?? null;
}

const getSessionUserByTokenCached = cache(async (token: string) => {
  return getSessionUserByTokenUncached(token);
});

export async function getSessionUserByToken(token: string) {
  return getSessionUserByTokenCached(token);
}

export async function revokeSession(token: string) {
  const pool = await getAuthPool();
  const tokenHash = hashToken(token);

  await pool
    .request()
    .query(`
      UPDATE dbo.Sesiones
      SET RevocadoEn = SYSUTCDATETIME()
      WHERE TokenHash = ${toSqlHex(tokenHash)}
    `);
}

export async function revokeSessionsForUser(userId: number) {
  const pool = await getAuthPool();

  await pool
    .request()
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE dbo.Sesiones
      SET RevocadoEn = SYSUTCDATETIME()
      WHERE UsuarioId = @userId
        AND RevocadoEn IS NULL
    `);
}

export async function recordAccessLog(user: SessionUser, ipAddress: string | null) {
  const pool = await getAuthPool();
  const usuario = user.Usuario.replace(/'/g, "''");
  const nombre = user.Nombre.replace(/'/g, "''");
  const direccionIp = (ipAddress ?? "").replace(/'/g, "''");

  await pool
    .request()
    .query(`
      INSERT INTO dbo.AccesosLog
        (UsuarioId, Usuario, Nombre, DireccionIp)
      VALUES
        (${user.Id}, N'${usuario}', N'${nombre}', ${ipAddress ? `N'${direccionIp}'` : "NULL"})
    `);
}

export async function listAccessLogs(top = 50): Promise<AccessLogRow[]> {
  const pool = await getAuthPool();
  const safeTop = Math.max(1, Math.min(500, Math.trunc(top) || 50));

  const result = await pool
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

  return result.recordset;
}
