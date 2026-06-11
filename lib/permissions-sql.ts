import sql from "mssql";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import { getAuthPool } from "@/lib/auth-sql";
import { ACTIONS, MODULES, ROLES } from "@/lib/permissions-config";
import { measureAsync } from "@/lib/server-performance";
import {
  DEFAULT_CACHE_REVALIDATE_SECONDS,
  PLATFORM_CACHE_TAGS,
} from "@/lib/platform-cache";

export type PermissionRow = {
  Rol: string;
  Modulo: string;
  Accion: string;
  Permitido: boolean;
};

type StoredPermissionRow = PermissionRow;

function defaultAllowed(role: string, module: string, action: string) {
  if (role === "Administrador") {
    return true;
  }

  if (role === "Supervisor") {
    return action === "Ver" && module !== "Permisos";
  }

  if (role === "Operador") {
    return action === "Ver" && (module === "Producción" || module === "Sistema OTN" || module === "Bodega");
  }

  return false;
}

export function buildDefaultPermissions(): PermissionRow[] {
  return ROLES.flatMap((role) =>
    MODULES.flatMap((module) =>
      ACTIONS.map((action) => ({
        Rol: role,
        Modulo: module,
        Accion: action,
        Permitido: defaultAllowed(role, module, action),
      })),
    ),
  );
}

async function readStoredPermissions(): Promise<StoredPermissionRow[]> {
  const pool = await getAuthPool();
  const result = await pool.request().query<StoredPermissionRow>(`
    SELECT
      Rol,
      Modulo,
      Accion,
      Permitido
    FROM dbo.Permisos
    ORDER BY Rol, Modulo, Accion
  `);

  return result.recordset.map((row) => ({
    ...row,
    Permitido: Boolean(row.Permitido),
  }));
}

const readStoredPermissionsCached = unstable_cache(
  async () => readStoredPermissions(),
  ["platform", "permissions"],
  {
    tags: [PLATFORM_CACHE_TAGS.permissions],
    revalidate: DEFAULT_CACHE_REVALIDATE_SECONDS,
  },
);

function mergePermissions(
  defaults: PermissionRow[],
  stored: StoredPermissionRow[],
): PermissionRow[] {
  const map = new Map<string, boolean>();
  for (const row of stored) {
    map.set(`${row.Rol}::${row.Modulo}::${row.Accion}`, Boolean(row.Permitido));
  }

  return defaults.map((row) => {
    const key = `${row.Rol}::${row.Modulo}::${row.Accion}`;
    return {
      ...row,
      Permitido: map.get(key) ?? row.Permitido,
    };
  });
}

const listPermissionsRequestCached = cache(async (): Promise<PermissionRow[]> => {
  return measureAsync(
    "permissions.listPermissions",
    async () => {
      const defaults = buildDefaultPermissions();
      const stored = await readStoredPermissionsCached();
      return mergePermissions(defaults, stored);
    },
    {
      slowMs: 75,
    },
  );
});

export async function listPermissions(): Promise<PermissionRow[]> {
  return listPermissionsRequestCached();
}

export function canAccess(
  permissions: PermissionRow[],
  role: string,
  module: string,
  action: string = "Ver",
) {
  return (
    permissions.find(
      (row) =>
        row.Rol === role &&
        row.Modulo === module &&
        row.Accion === action,
    )?.Permitido ?? false
  );
}

export async function savePermissions(rows: PermissionRow[]) {
  const pool = await getAuthPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    await transaction.request().query(`DELETE FROM dbo.Permisos`);

    for (const row of rows) {
      await transaction
        .request()
        .input("rol", sql.NVarChar(50), row.Rol)
        .input("modulo", sql.NVarChar(50), row.Modulo)
        .input("accion", sql.NVarChar(50), row.Accion)
        .input("permitido", sql.Bit, row.Permitido)
        .query(`
          INSERT INTO dbo.Permisos
            (Rol, Modulo, Accion, Permitido, ActualizadoEn)
          VALUES
            (@rol, @modulo, @accion, @permitido, SYSUTCDATETIME())
        `);
    }

    await transaction.commit();
    revalidateTag(PLATFORM_CACHE_TAGS.permissions, "max");
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export { ROLES, MODULES, ACTIONS };
