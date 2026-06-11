import { revalidateTag, unstable_cache } from "next/cache";
import { getAuthPool } from "@/lib/auth-sql";
import {
  DEFAULT_CACHE_REVALIDATE_SECONDS,
  PLATFORM_CACHE_TAGS,
} from "@/lib/platform-cache";

export type CatalogRow = {
  Id: number;
  Nombre: string;
};

export type ActivoFijoRow = {
  Id: number;
  AF: string;
  OC: string | null;
  Descripcion: string;
  TipoActivoId: number | null;
  TipoActivo: string | null;
  MarcaId: number | null;
  Marca: string | null;
  Modelo: string | null;
  SeriePatente: string | null;
  NumeroFactura: string | null;
  FechaFactura: string | null;
  Valor: number | null;
  PropioLeasing: string | null;
  TotalmenteDepreciado: boolean | null;
  Anio: number | null;
  Observacion: string | null;
  GrupoContableId: number | null;
  GrupoContable: string | null;
  CreadoEn: string;
  ActualizadoEn: string;
};

export type ActivoFijoCatalogos = {
  tipos: CatalogRow[];
  marcas: CatalogRow[];
  gruposContables: CatalogRow[];
};

type CatalogKey = "tipo" | "marca" | "grupoContable";

const CATALOG_TABLES: Record<CatalogKey, { tableName: string }> = {
  tipo: {
    tableName: "dbo.ActivosFijosTipos",
  },
  marca: {
    tableName: "dbo.ActivosFijosMarcas",
  },
  grupoContable: {
    tableName: "dbo.ActivosFijosGruposContables",
  },
};

function normalizeBooleanId(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function repairMojibake(value: string) {
  if (!/[ÃÂ]/.test(value)) {
    return value.trim();
  }

  try {
    return Buffer.from(value, "latin1").toString("utf8").trim();
  } catch {
    return value.trim();
  }
}

function escapeSqlString(value: string) {
  return value.replace(/'/g, "''");
}

function sqlString(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  return `N'${escapeSqlString(value)}'`;
}

function sqlNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "NULL" : String(value);
}

function sqlBit(value: boolean | null | undefined) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  return value ? "1" : "0";
}

function sqlDate(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "NULL";
  }

  return `CONVERT(date, N'${escapeSqlString(trimmed)}', 23)`;
}

function deriveYearFromDate(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(trimmed);
  return match ? Number(match[1]) : null;
}

function normalizeCatalogRow(row: CatalogRow): CatalogRow {
  return {
    ...row,
    Nombre: repairMojibake(row.Nombre),
  };
}

const listActivosFijosCached = unstable_cache(
  async () => {
    const pool = await getAuthPool();
    const result = await pool.request().query<ActivoFijoRow>(`
      SELECT
        AF.Id,
        AF.AF,
        AF.OC,
        AF.Descripcion,
        AF.TipoActivoId,
        T.Nombre AS TipoActivo,
        AF.MarcaId,
        M.Nombre AS Marca,
        AF.Modelo,
        AF.SeriePatente,
        AF.NumeroFactura,
        CONVERT(varchar(10), AF.FechaFactura, 23) AS FechaFactura,
        AF.Valor,
        AF.PropioLeasing,
        AF.TotalmenteDepreciado,
        CASE
          WHEN AF.FechaFactura IS NULL THEN NULL
          ELSE YEAR(AF.FechaFactura)
        END AS Anio,
        AF.Observacion,
        AF.GrupoContableId,
        G.Nombre AS GrupoContable,
        CONVERT(varchar(19), AF.CreadoEn, 120) AS CreadoEn,
        CONVERT(varchar(19), AF.ActualizadoEn, 120) AS ActualizadoEn
      FROM dbo.ActivosFijos AF
      LEFT JOIN dbo.ActivosFijosTipos T
        ON T.Id = AF.TipoActivoId
      LEFT JOIN dbo.ActivosFijosMarcas M
        ON M.Id = AF.MarcaId
      LEFT JOIN dbo.ActivosFijosGruposContables G
        ON G.Id = AF.GrupoContableId
      ORDER BY AF.AF ASC, AF.Id DESC
    `);

    return result.recordset;
  },
  ["platform", "activos-fijos", "list"],
  {
    tags: [PLATFORM_CACHE_TAGS.activosFijos],
    revalidate: DEFAULT_CACHE_REVALIDATE_SECONDS,
  },
);

async function listActivosFijosCatalogosCached() {
  const pool = await getAuthPool();
  const [tipos, marcas, gruposContables] = await Promise.all([
    pool.request().query<CatalogRow>(`
      SELECT Id, Nombre
      FROM dbo.ActivosFijosTipos
      ORDER BY Nombre ASC, Id ASC
    `),
    pool.request().query<CatalogRow>(`
      SELECT Id, Nombre
      FROM dbo.ActivosFijosMarcas
      ORDER BY Nombre ASC, Id ASC
    `),
    pool.request().query<CatalogRow>(`
      SELECT Id, Nombre
      FROM dbo.ActivosFijosGruposContables
      ORDER BY Nombre ASC, Id ASC
    `),
  ]);

  return {
    tipos: tipos.recordset.map(normalizeCatalogRow),
    marcas: marcas.recordset.map(normalizeCatalogRow),
    gruposContables: gruposContables.recordset.map(normalizeCatalogRow),
  };
}

export async function listActivosFijos(): Promise<ActivoFijoRow[]> {
  return listActivosFijosCached();
}

export async function getActivoFijoById(id: number): Promise<ActivoFijoRow | null> {
  const pool = await getAuthPool();
  const result = await pool.request().query<ActivoFijoRow>(`
    SELECT
      AF.Id,
      AF.AF,
      AF.OC,
      AF.Descripcion,
      AF.TipoActivoId,
      T.Nombre AS TipoActivo,
      AF.MarcaId,
      M.Nombre AS Marca,
      AF.Modelo,
      AF.SeriePatente,
      AF.NumeroFactura,
      CONVERT(varchar(10), AF.FechaFactura, 23) AS FechaFactura,
      AF.Valor,
      AF.PropioLeasing,
      AF.TotalmenteDepreciado,
      CASE
        WHEN AF.FechaFactura IS NULL THEN NULL
        ELSE YEAR(AF.FechaFactura)
      END AS Anio,
      AF.Observacion,
      AF.GrupoContableId,
      G.Nombre AS GrupoContable,
      CONVERT(varchar(19), AF.CreadoEn, 120) AS CreadoEn,
      CONVERT(varchar(19), AF.ActualizadoEn, 120) AS ActualizadoEn
    FROM dbo.ActivosFijos AF
    LEFT JOIN dbo.ActivosFijosTipos T
      ON T.Id = AF.TipoActivoId
    LEFT JOIN dbo.ActivosFijosMarcas M
      ON M.Id = AF.MarcaId
    LEFT JOIN dbo.ActivosFijosGruposContables G
      ON G.Id = AF.GrupoContableId
    WHERE AF.Id = ${id}
  `);

  return result.recordset[0] ?? null;
}

export async function listActivosFijosCatalogos(): Promise<ActivoFijoCatalogos> {
  return listActivosFijosCatalogosCached();
}

export async function listActivosFijosPageData() {
  const [activos, catalogos] = await Promise.all([
    listActivosFijos(),
    listActivosFijosCatalogos(),
  ]);

  return { activos, catalogos };
}

function catalogMeta(category: CatalogKey) {
  return CATALOG_TABLES[category];
}

export async function createActivoFijo(input: {
  AF: string;
  OC?: string | null;
  Descripcion: string;
  TipoActivoId?: number | null;
  MarcaId?: number | null;
  Modelo?: string | null;
  SeriePatente?: string | null;
  NumeroFactura?: string | null;
  FechaFactura?: string | null;
  Valor?: number | null;
  PropioLeasing?: string | null;
  TotalmenteDepreciado?: boolean | null;
  Observacion?: string | null;
  GrupoContableId?: number | null;
}) {
  const pool = await getAuthPool();
  const AF = sqlString(input.AF);
  const OC = sqlString(input.OC ?? null);
  const Descripcion = sqlString(input.Descripcion);
  const TipoActivoId = sqlNumber(normalizeBooleanId(input.TipoActivoId));
  const MarcaId = sqlNumber(normalizeBooleanId(input.MarcaId));
  const Modelo = sqlString(input.Modelo ?? null);
  const SeriePatente = sqlString(input.SeriePatente ?? null);
  const NumeroFactura = sqlString(input.NumeroFactura ?? null);
  const FechaFactura = sqlDate(input.FechaFactura ?? null);
  const Valor = sqlNumber(input.Valor);
  const PropioLeasing = sqlString(input.PropioLeasing ?? null);
  const TotalmenteDepreciado = sqlBit(input.TotalmenteDepreciado);
  const Anio = sqlNumber(deriveYearFromDate(input.FechaFactura));
  const Observacion = sqlString(input.Observacion ?? null);
  const GrupoContableId = sqlNumber(normalizeBooleanId(input.GrupoContableId));

  await pool.request().query(`
    INSERT INTO dbo.ActivosFijos
      (
        AF,
        OC,
        Descripcion,
        TipoActivoId,
        MarcaId,
        Modelo,
        SeriePatente,
        NumeroFactura,
        FechaFactura,
        Valor,
        PropioLeasing,
        TotalmenteDepreciado,
        Anio,
        Observacion,
        GrupoContableId
      )
    VALUES
      (
        ${AF},
        ${OC},
        ${Descripcion},
        ${TipoActivoId},
        ${MarcaId},
        ${Modelo},
        ${SeriePatente},
        ${NumeroFactura},
        ${FechaFactura},
        ${Valor},
        ${PropioLeasing},
        ${TotalmenteDepreciado},
        ${Anio},
        ${Observacion},
        ${GrupoContableId}
      )
  `);

  revalidateTag(PLATFORM_CACHE_TAGS.activosFijos, "max");
}

export async function updateActivoFijo(input: {
  id: number;
  AF: string;
  OC?: string | null;
  Descripcion: string;
  TipoActivoId?: number | null;
  MarcaId?: number | null;
  Modelo?: string | null;
  SeriePatente?: string | null;
  NumeroFactura?: string | null;
  FechaFactura?: string | null;
  Valor?: number | null;
  PropioLeasing?: string | null;
  TotalmenteDepreciado?: boolean | null;
  Observacion?: string | null;
  GrupoContableId?: number | null;
}) {
  const pool = await getAuthPool();
  const AF = sqlString(input.AF);
  const OC = sqlString(input.OC ?? null);
  const Descripcion = sqlString(input.Descripcion);
  const TipoActivoId = sqlNumber(normalizeBooleanId(input.TipoActivoId));
  const MarcaId = sqlNumber(normalizeBooleanId(input.MarcaId));
  const Modelo = sqlString(input.Modelo ?? null);
  const SeriePatente = sqlString(input.SeriePatente ?? null);
  const NumeroFactura = sqlString(input.NumeroFactura ?? null);
  const FechaFactura = sqlDate(input.FechaFactura ?? null);
  const Valor = sqlNumber(input.Valor);
  const PropioLeasing = sqlString(input.PropioLeasing ?? null);
  const TotalmenteDepreciado = sqlBit(input.TotalmenteDepreciado);
  const Anio = sqlNumber(deriveYearFromDate(input.FechaFactura));
  const Observacion = sqlString(input.Observacion ?? null);
  const GrupoContableId = sqlNumber(normalizeBooleanId(input.GrupoContableId));

  await pool.request().query(`
    UPDATE dbo.ActivosFijos
    SET
      AF = ${AF},
      OC = ${OC},
      Descripcion = ${Descripcion},
      TipoActivoId = ${TipoActivoId},
      MarcaId = ${MarcaId},
      Modelo = ${Modelo},
      SeriePatente = ${SeriePatente},
      NumeroFactura = ${NumeroFactura},
      FechaFactura = ${FechaFactura},
      Valor = ${Valor},
      PropioLeasing = ${PropioLeasing},
      TotalmenteDepreciado = ${TotalmenteDepreciado},
      Anio = ${Anio},
      Observacion = ${Observacion},
      GrupoContableId = ${GrupoContableId},
      ActualizadoEn = SYSUTCDATETIME()
    WHERE Id = ${input.id}
  `);

  revalidateTag(PLATFORM_CACHE_TAGS.activosFijos, "max");
}

export async function createCatalogItem(category: CatalogKey, nombre: string) {
  const meta = catalogMeta(category);
  const pool = await getAuthPool();
  const normalizedNombre = repairMojibake(nombre);
  const safeNombre = escapeSqlString(normalizedNombre);

  await pool.request().query(`
    INSERT INTO ${meta.tableName}
      (Nombre)
    VALUES
      (N'${safeNombre}')
  `);

  revalidateTag(PLATFORM_CACHE_TAGS.activosFijos, "max");
}

export async function getCatalogItemByName(category: CatalogKey, nombre: string) {
  const meta = catalogMeta(category);
  const pool = await getAuthPool();
  const safeNombre = escapeSqlString(repairMojibake(nombre));
  const result = await pool.request().query<CatalogRow>(`
    SELECT Id, Nombre
    FROM ${meta.tableName}
    WHERE Nombre = N'${safeNombre}'
  `);

  return result.recordset[0] ?? null;
}

export async function getCatalogItemById(category: CatalogKey, id: number) {
  const meta = catalogMeta(category);
  const pool = await getAuthPool();
  const safeId = Number(id);
  if (!Number.isInteger(safeId) || safeId <= 0) {
    throw new Error("Debes indicar un id válido.");
  }

  const result = await pool.request().query<CatalogRow>(`
    SELECT Id, Nombre
    FROM ${meta.tableName}
    WHERE Id = ${safeId}
  `);

  return result.recordset[0] ?? null;
}

export async function updateCatalogItem(category: CatalogKey, id: number, nombre: string) {
  const meta = catalogMeta(category);
  const pool = await getAuthPool();
  const normalizedNombre = repairMojibake(nombre);
  const safeNombre = escapeSqlString(normalizedNombre);
  const safeId = Number(id);
  if (!Number.isInteger(safeId) || safeId <= 0) {
    throw new Error("Debes indicar un id válido.");
  }

  const result = await pool.request().query(`
    UPDATE ${meta.tableName}
    SET Nombre = N'${safeNombre}'
    WHERE Id = ${safeId}
  `);

  if (!result.rowsAffected[0]) {
    throw new Error("No se actualizó ningún registro.");
  }

  revalidateTag(PLATFORM_CACHE_TAGS.activosFijos, "max");
}

export async function countCatalogItemUsage(category: CatalogKey, id: number) {
  const pool = await getAuthPool();
  const columnName =
    category === "tipo"
      ? "TipoActivoId"
      : category === "marca"
        ? "MarcaId"
        : "GrupoContableId";
  const safeId = Number(id);
  if (!Number.isInteger(safeId) || safeId <= 0) {
    throw new Error("Debes indicar un id válido.");
  }

  const result = await pool.request().query<{ total: number }>(`
    SELECT COUNT(1) AS total
    FROM dbo.ActivosFijos
    WHERE ${columnName} = ${safeId}
  `);

  return result.recordset[0]?.total ?? 0;
}

export async function deleteCatalogItem(category: CatalogKey, id: number) {
  const meta = catalogMeta(category);
  const pool = await getAuthPool();
  const usage = await countCatalogItemUsage(category, id);
  const safeId = Number(id);
  if (!Number.isInteger(safeId) || safeId <= 0) {
    throw new Error("Debes indicar un id válido.");
  }

  if (usage > 0) {
    throw new Error(`No se puede eliminar porque está asociado a ${usage} activo(s) fijo(s).`);
  }

  const result = await pool.request().query(`
    DELETE FROM ${meta.tableName}
    WHERE Id = ${safeId}
  `);

  if (!result.rowsAffected[0]) {
    throw new Error("No se eliminó ningún registro.");
  }

  revalidateTag(PLATFORM_CACHE_TAGS.activosFijos, "max");
}

export type { CatalogKey };
