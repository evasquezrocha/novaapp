import { getAuthPool } from "@/lib/auth-sql";

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

const CATALOG_TABLES: Record<
  CatalogKey,
  { tableName: string }
> = {
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

function normalizeCatalogRow(row: CatalogRow): CatalogRow {
  return {
    ...row,
    Nombre: row.Nombre.trim(),
  };
}

export async function listActivosFijos(): Promise<ActivoFijoRow[]> {
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
      AF.Anio,
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
      AF.Anio,
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
  Anio?: number | null;
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
  const Anio = sqlNumber(normalizeBooleanId(input.Anio));
  const Observacion = sqlString(input.Observacion ?? null);
  const GrupoContableId = sqlNumber(normalizeBooleanId(input.GrupoContableId));

  await pool.request().query(`
    INSERT INTO dbo.ActivosFijos
      (AF, OC, Descripcion, TipoActivoId, MarcaId, Modelo, SeriePatente, Anio, Observacion, GrupoContableId)
    VALUES
      (${AF}, ${OC}, ${Descripcion}, ${TipoActivoId}, ${MarcaId}, ${Modelo}, ${SeriePatente}, ${Anio}, ${Observacion}, ${GrupoContableId})
  `);
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
  Anio?: number | null;
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
  const Anio = sqlNumber(normalizeBooleanId(input.Anio));
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
      Anio = ${Anio},
      Observacion = ${Observacion},
      GrupoContableId = ${GrupoContableId},
      ActualizadoEn = SYSUTCDATETIME()
    WHERE Id = ${input.id}
  `);
}

export async function createCatalogItem(category: CatalogKey, nombre: string) {
  const meta = catalogMeta(category);
  const pool = await getAuthPool();
  const safeNombre = escapeSqlString(nombre);

  await pool.request().query(`
    INSERT INTO ${meta.tableName}
      (Nombre)
    VALUES
      (N'${safeNombre}')
  `);
}

export async function getCatalogItemByName(category: CatalogKey, nombre: string) {
  const meta = catalogMeta(category);
  const pool = await getAuthPool();
  const safeNombre = escapeSqlString(nombre);
  const result = await pool.request().query<CatalogRow>(`
    SELECT Id, Nombre
    FROM ${meta.tableName}
    WHERE Nombre = N'${safeNombre}'
  `);

  return result.recordset[0] ?? null;
}

export type { CatalogKey };
