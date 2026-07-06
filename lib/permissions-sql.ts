import sql from "mssql";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import { getAuthPool } from "@/lib/auth-sql";
import { ACTIONS, MODULE_SECTIONS, MODULES, ROLES } from "@/lib/permissions-config";
import { listRoles as listStoredRoles } from "@/lib/roles-sql";
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

function defaultAllowed(role: string, moduleName: string, action: string) {
  if (role === "Administrador") {
    return true;
  }

  if ((role === "RRHH" || role === "Gerencia") && moduleName === "Asistencia") {
    return action === "Ver";
  }

  if (role === "Supervisor") {
    return action === "Ver" && moduleName !== "Permisos";
  }

  if (role === "Operador") {
    return (
      action === "Ver" &&
      (moduleName === "Producción" || moduleName === "Sistema OTN" || moduleName === "Bodega")
    );
  }

  return false;
}

export async function buildDefaultPermissions(): Promise<PermissionRow[]> {
  const storedRoles = await listStoredRoles();
  const roles = storedRoles.length > 0 ? storedRoles : [...ROLES];

  const defaults: PermissionRow[] = [];

  for (const role of roles) {
    for (const moduleName of MODULES) {
      for (const action of ACTIONS) {
        defaults.push({
          Rol: role,
          Modulo: moduleName,
          Accion: action,
          Permitido: defaultAllowed(role, moduleName, action),
        });
      }
    }

    for (const section of MODULE_SECTIONS) {
      const parentModule = section.modules[0];

      for (const submodule of section.submodules) {
        defaults.push({
          Rol: role,
          Modulo: submodule,
          Accion: "Ver",
          Permitido: defaultAllowed(role, parentModule, "Ver"),
        });
      }
    }
  }

  return defaults.filter(
    (row, index, self) =>
      index ===
      self.findIndex(
        (candidate) =>
          candidate.Rol === row.Rol &&
          candidate.Modulo === row.Modulo &&
          candidate.Accion === row.Accion,
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
    tags: [PLATFORM_CACHE_TAGS.permissions, PLATFORM_CACHE_TAGS.roles],
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
      const defaults = await buildDefaultPermissions();
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
