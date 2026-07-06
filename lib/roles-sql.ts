import sql from "mssql";
import { revalidateTag, unstable_cache } from "next/cache";
import { getAuthPool } from "@/lib/auth-sql";
import { ensureDatabaseSchema } from "@/lib/db-schema";
import { ROLES as DEFAULT_ROLES } from "@/lib/permissions-config";
import {
  DEFAULT_CACHE_REVALIDATE_SECONDS,
  PLATFORM_CACHE_TAGS,
} from "@/lib/platform-cache";

export type RoleRow = {
  Id: number;
  Nombre: string;
  EsSistema: boolean;
  Orden: number;
  CreadoEn: string;
  ActualizadoEn: string;
};

type StoredRoleRow = {
  Id: number;
  Nombre: string;
  EsSistema: boolean;
  Orden: number;
  CreadoEn: string;
  ActualizadoEn: string;
};

function normalizeRoleRow(row: StoredRoleRow): RoleRow {
  return {
    ...row,
    EsSistema: Boolean(row.EsSistema),
  };
}

async function getPool() {
  await ensureDatabaseSchema();
  return getAuthPool();
}

async function readStoredRoles(): Promise<RoleRow[]> {
  const pool = await getPool();
  const result = await pool.request().query<StoredRoleRow>(`
    SELECT
      Id,
      Nombre,
      EsSistema,
      Orden,
      CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
      CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
    FROM dbo.Roles
    ORDER BY Orden ASC, Nombre ASC, Id ASC
  `);

  return result.recordset.map(normalizeRoleRow);
}

const readStoredRolesCached = unstable_cache(
  async () => readStoredRoles(),
  ["platform", "roles"],
  {
    tags: [PLATFORM_CACHE_TAGS.roles],
    revalidate: DEFAULT_CACHE_REVALIDATE_SECONDS,
  },
);

export async function listRoles(): Promise<string[]> {
  return (await readStoredRolesCached()).map((row) => row.Nombre);
}

export async function listRoleRows(): Promise<RoleRow[]> {
  return readStoredRolesCached();
}

export async function createRole(nombre: string): Promise<RoleRow> {
  const trimmedName = nombre.trim();

  if (!trimmedName) {
    throw new Error("Debes ingresar un nombre de rol.");
  }

  if (trimmedName.length > 50) {
    throw new Error("El nombre del rol no puede superar 50 caracteres.");
  }

  const pool = await getPool();
  const escapedName = trimmedName.replace(/'/g, "''");
  const existing = await pool.request().query<StoredRoleRow>(`
    SELECT TOP (1)
      Id,
      Nombre,
      EsSistema,
      Orden,
      CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
      CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
    FROM dbo.Roles
    WHERE Nombre = N'${escapedName}'
  `);

  if (existing.recordset[0]) {
    throw new Error("Ese rol ya existe.");
  }

  const nextOrderResult = await pool.request().query<{ NextOrden: number }>(`
    SELECT ISNULL(MAX(Orden), 0) + 1 AS NextOrden
    FROM dbo.Roles
  `);
  const nextOrder = nextOrderResult.recordset[0]?.NextOrden ?? DEFAULT_ROLES.length + 1;

  await pool.request().query(`
    INSERT INTO dbo.Roles (Nombre, EsSistema, Orden, CreadoEn, ActualizadoEn)
    VALUES (N'${escapedName}', 0, ${nextOrder}, SYSUTCDATETIME(), SYSUTCDATETIME())
  `);

  const created = await pool
    .request()
    .query<StoredRoleRow>(`
      SELECT TOP (1)
        Id,
        Nombre,
        EsSistema,
        Orden,
        CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
        CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
      FROM dbo.Roles
      WHERE Nombre = N'${escapedName}'
    `);

  revalidateTag(PLATFORM_CACHE_TAGS.roles, "max");
  revalidateTag(PLATFORM_CACHE_TAGS.permissions, "max");

  const role = created.recordset[0];
  if (!role) {
    throw new Error("No fue posible crear el rol.");
  }

  return normalizeRoleRow(role);
}

export async function updateRole(id: number, nombre: string): Promise<RoleRow> {
  const trimmedName = nombre.trim();

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("El rol seleccionado no es válido.");
  }

  if (!trimmedName) {
    throw new Error("Debes ingresar un nombre de rol.");
  }

  if (trimmedName.length > 50) {
    throw new Error("El nombre del rol no puede superar 50 caracteres.");
  }

  const pool = await getPool();
  const escapedName = trimmedName.replace(/'/g, "''");
  const existingResult = await pool
    .request()
    .input("id", sql.Int, id)
    .query<StoredRoleRow>(`
      SELECT TOP (1)
        Id,
        Nombre,
        EsSistema,
        Orden,
        CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
        CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
      FROM dbo.Roles
      WHERE Id = @id
    `);

  const existing = existingResult.recordset[0];
  if (!existing) {
    throw new Error("No se encontró el rol seleccionado.");
  }

  if (existing.EsSistema) {
    throw new Error("No puedes editar un rol de sistema.");
  }

  const duplicateResult = await pool
    .request()
    .input("id", sql.Int, id)
    .query<StoredRoleRow>(`
      SELECT TOP (1)
        Id
      FROM dbo.Roles
      WHERE Nombre = N'${escapedName}'
        AND Id <> @id
    `);

  if (duplicateResult.recordset[0]) {
    throw new Error("Ese rol ya existe.");
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await transaction
      .request()
      .input("id", sql.Int, id)
      .query(`
        UPDATE dbo.Roles
        SET
          Nombre = N'${escapedName}',
          ActualizadoEn = SYSUTCDATETIME()
        WHERE Id = @id
      `);

    await transaction
      .request()
      .query(`
        UPDATE dbo.Usuarios
        SET Rol = N'${escapedName}',
            ActualizadoEn = SYSUTCDATETIME()
        WHERE Rol = N'${existing.Nombre.replace(/'/g, "''")}'
      `);

    await transaction
      .request()
      .query(`
        UPDATE dbo.Permisos
        SET Rol = N'${escapedName}',
            ActualizadoEn = SYSUTCDATETIME()
        WHERE Rol = N'${existing.Nombre.replace(/'/g, "''")}'
      `);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  revalidateTag(PLATFORM_CACHE_TAGS.roles, "max");
  revalidateTag(PLATFORM_CACHE_TAGS.permissions, "max");
  revalidateTag(PLATFORM_CACHE_TAGS.usuarios, "max");

  const updatedResult = await pool
    .request()
    .input("id", sql.Int, id)
    .query<StoredRoleRow>(`
      SELECT TOP (1)
        Id,
        Nombre,
        EsSistema,
        Orden,
        CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
        CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
      FROM dbo.Roles
      WHERE Id = @id
    `);

  const updated = updatedResult.recordset[0];
  if (!updated) {
    throw new Error("No fue posible actualizar el rol.");
  }

  return normalizeRoleRow(updated);
}

export async function deleteRole(id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("El rol seleccionado no es válido.");
  }

  const pool = await getPool();
  const existingResult = await pool
    .request()
    .input("id", sql.Int, id)
    .query<StoredRoleRow>(`
      SELECT TOP (1)
        Id,
        Nombre,
        EsSistema,
        Orden,
        CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
        CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
      FROM dbo.Roles
      WHERE Id = @id
    `);

  const existing = existingResult.recordset[0];
  if (!existing) {
    throw new Error("No se encontró el rol seleccionado.");
  }

  if (existing.EsSistema) {
    throw new Error("No puedes eliminar un rol de sistema.");
  }

  const usersUsingRole = await pool
    .request()
    .query<{ Total: number }>(`
      SELECT COUNT(1) AS Total
      FROM dbo.Usuarios
      WHERE Rol = N'${existing.Nombre.replace(/'/g, "''")}'
    `);

  if ((usersUsingRole.recordset[0]?.Total ?? 0) > 0) {
    throw new Error("No puedes eliminar un rol que todavía está asignado a usuarios.");
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await transaction
      .request()
      .query(`DELETE FROM dbo.Permisos WHERE Rol = N'${existing.Nombre.replace(/'/g, "''")}'`);

    await transaction
      .request()
      .input("id", sql.Int, id)
      .query(`DELETE FROM dbo.Roles WHERE Id = @id`);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  revalidateTag(PLATFORM_CACHE_TAGS.roles, "max");
  revalidateTag(PLATFORM_CACHE_TAGS.permissions, "max");
}
