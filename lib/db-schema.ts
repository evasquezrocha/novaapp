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
  var __dbSchemaActivosFijosInit: Promise<void> | undefined;
  var __dbSchemaSistemaOtnInit: Promise<void> | undefined;
  var __dbSchemaSistemaOtnAprobacionesInit: Promise<void> | undefined;
  var __dbSchemaSistemaOtnEntregasManualesInit: Promise<void> | undefined;
  var __dbSchemaCtSupervisoresInit: Promise<void> | undefined;
}

function buildConfig(): DbEnv {
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

function splitSqlBatches(sqlText: string) {
  return sqlText
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((part) => part.trim())
    .filter(Boolean);
}

async function runSqlFile(pool: sql.ConnectionPool, relativePath: string) {
  const sqlText = await fs.readFile(
    path.join(/* turbopackIgnore: true */ process.cwd(), relativePath),
    "utf8",
  );

  for (const batch of splitSqlBatches(sqlText)) {
    await pool.request().batch(batch);
  }
}

async function tableExists(pool: sql.ConnectionPool, tableName: string) {
  const result = await pool
    .request()
    .input("tableName", sql.NVarChar(256), tableName)
    .query<{ Exists: number }>(`
      SELECT CASE
        WHEN OBJECT_ID(@tableName, 'U') IS NULL THEN 0
        ELSE 1
      END AS [Exists]
    `);

  return Boolean(result.recordset[0]?.Exists);
}

const CREATE_SISTEMA_OTN_APROBACIONES_SQL = `
IF OBJECT_ID('dbo.SistemaOtnAprobaciones', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.SistemaOtnAprobaciones (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SistemaOtnAprobaciones PRIMARY KEY,
    OTN NVARCHAR(50) NOT NULL,
    FechaAprobacion DATE NOT NULL,
    ValorAprobado DECIMAL(18,2) NOT NULL,
    OC NVARCHAR(100) NULL,
    ReferenciaCliente NVARCHAR(150) NULL,
    CreadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_SistemaOtnAprobaciones_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_SistemaOtnAprobaciones_ActualizadoEn DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_SistemaOtnAprobaciones_OTN_FechaAprobacion_Id
    ON dbo.SistemaOtnAprobaciones(OTN, FechaAprobacion DESC, Id DESC)
    INCLUDE (ValorAprobado, OC, ReferenciaCliente, CreadoEn, ActualizadoEn);
END;
`;

const ENSURE_ACCESS_LOGS_INDEX_SQL = `
IF OBJECT_ID('dbo.AccesosLog', 'U') IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.AccesosLog')
    AND name = 'IX_AccesosLog_AccedidoEn_Id'
)
BEGIN
  CREATE INDEX IX_AccesosLog_AccedidoEn_Id
    ON dbo.AccesosLog(AccedidoEn DESC, Id DESC)
    INCLUDE (UsuarioId, Usuario, Nombre, DireccionIp);
END;
`;

const ENSURE_USUARIOS_INDEX_SQL = `
IF OBJECT_ID('dbo.Usuarios', 'U') IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.Usuarios')
    AND name = 'IX_Usuarios_Nombre_Id'
)
BEGIN
  CREATE INDEX IX_Usuarios_Nombre_Id
    ON dbo.Usuarios(Nombre ASC, Id DESC)
    INCLUDE (Usuario, Correo, Rol, Activo, CreadoEn, ActualizadoEn);
END;
`;

const ENSURE_SISTEMA_OTN_APROBACIONES_INDEX_SQL = `
IF OBJECT_ID('dbo.SistemaOtnAprobaciones', 'U') IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.SistemaOtnAprobaciones')
    AND name = 'IX_SistemaOtnAprobaciones_OTN_FechaAprobacion_Id'
)
BEGIN
  CREATE INDEX IX_SistemaOtnAprobaciones_OTN_FechaAprobacion_Id
    ON dbo.SistemaOtnAprobaciones(OTN, FechaAprobacion DESC, Id DESC)
    INCLUDE (ValorAprobado, OC, ReferenciaCliente, CreadoEn, ActualizadoEn);
END;
`;

const ENSURE_SISTEMA_OTN_ENTREGAS_MANUALES_INDEX_SQL = `
IF OBJECT_ID('dbo.SistemaOtnEntregasManuales', 'U') IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.SistemaOtnEntregasManuales')
    AND name = 'IX_SistemaOtnEntregasManuales_OTN_FechaEntrega_Id'
)
BEGIN
  CREATE INDEX IX_SistemaOtnEntregasManuales_OTN_FechaEntrega_Id
    ON dbo.SistemaOtnEntregasManuales(OTN, FechaEntrega DESC, Id DESC)
    INCLUDE (ValorEntrega, ReferenciaEntrega, CreadoEn, ActualizadoEn);
END;
`;

const ENSURE_CT_SUPERVISORES_COLUMNS_SQL = `
IF OBJECT_ID('dbo.CtSupervisores', 'U') IS NOT NULL
AND COL_LENGTH('dbo.CtSupervisores', 'Correlativo') IS NULL
BEGIN
  ALTER TABLE dbo.CtSupervisores
    ADD Correlativo NVARCHAR(50) NOT NULL CONSTRAINT DF_CtSupervisores_Correlativo DEFAULT ('');
END;

IF OBJECT_ID('dbo.CtSupervisores', 'U') IS NOT NULL
AND COL_LENGTH('dbo.CtSupervisores', 'Estado') IS NULL
BEGIN
  ALTER TABLE dbo.CtSupervisores
    ADD Estado NVARCHAR(50) NOT NULL CONSTRAINT DF_CtSupervisores_Estado DEFAULT (N'Ingresado');
END;
`;

const ENSURE_SISTEMA_OTN_INDEXES_SQL = `
IF OBJECT_ID('dbo.SistemaOtn', 'U') IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.SistemaOtn')
    AND name = 'IX_SistemaOtn_Id_DESC'
)
BEGIN
  CREATE INDEX IX_SistemaOtn_Id_DESC
    ON dbo.SistemaOtn(Id DESC)
    INCLUDE (
      OTN,
      Estado,
      FechaIngreso,
      Cliente,
      Empresa,
      EntregaFuente,
      Solicitante,
      CC,
      Cantidad,
      Descripcion,
      ReferenciaCliente,
      Cotizador,
      Equipo,
      FechaPpto,
      ValorPpto,
      Plazo,
      Ruta,
      CreadoEn,
      ActualizadoEn
    );
END;
`;

async function ensureSistemaOtnAprobacionesSchema(pool: sql.ConnectionPool) {
  const hasAprobaciones = await tableExists(pool, "dbo.SistemaOtnAprobaciones");

  if (!hasAprobaciones) {
    for (const batch of splitSqlBatches(CREATE_SISTEMA_OTN_APROBACIONES_SQL)) {
      await pool.request().batch(batch);
    }
    return;
  }

  for (const batch of splitSqlBatches(ENSURE_SISTEMA_OTN_APROBACIONES_INDEX_SQL)) {
    await pool.request().batch(batch);
  }
}

const ADD_SISTEMA_OTN_EMPRESA_SQL = `
IF OBJECT_ID('dbo.SistemaOtn', 'U') IS NOT NULL
AND COL_LENGTH('dbo.SistemaOtn', 'Empresa') IS NULL
BEGIN
  ALTER TABLE dbo.SistemaOtn
    ADD Empresa NVARCHAR(50) NULL;
END;
`;

const ADD_SISTEMA_OTN_ENTREGA_FUENTE_COLUMN_SQL = `
IF OBJECT_ID('dbo.SistemaOtn', 'U') IS NOT NULL
AND COL_LENGTH('dbo.SistemaOtn', 'EntregaFuente') IS NULL
BEGIN
  ALTER TABLE dbo.SistemaOtn
    ADD EntregaFuente NVARCHAR(10) NOT NULL
      CONSTRAINT DF_SistemaOtn_EntregaFuente DEFAULT N'sap'
      WITH VALUES;
END;
`;

const FIX_SISTEMA_OTN_ENTREGA_FUENTE_SQL = `
IF OBJECT_ID('dbo.SistemaOtn', 'U') IS NOT NULL
AND COL_LENGTH('dbo.SistemaOtn', 'EntregaFuente') IS NOT NULL
BEGIN
  UPDATE dbo.SistemaOtn
    SET EntregaFuente = N'sap'
  WHERE EntregaFuente IS NULL
     OR LTRIM(RTRIM(EntregaFuente)) = N'';
END;
`;

const FIX_SISTEMA_OTN_EQUIPO_SQL = `
IF OBJECT_ID('dbo.SistemaOtn', 'U') IS NOT NULL
AND COL_LENGTH('dbo.SistemaOtn', 'Equipo') IS NOT NULL
BEGIN
  UPDATE dbo.SistemaOtn
    SET Equipo = N'Sí'
  WHERE Equipo IS NULL
     OR LTRIM(RTRIM(Equipo)) = N''
     OR Equipo = N'SÃ­';
END;
`;

const ENSURE_ACTIVOS_FIJOS_COLUMNS_SQL = `
IF OBJECT_ID('dbo.ActivosFijos', 'U') IS NOT NULL
AND COL_LENGTH('dbo.ActivosFijos', 'NumeroFactura') IS NULL
BEGIN
  ALTER TABLE dbo.ActivosFijos
    ADD NumeroFactura NVARCHAR(50) NULL;
END;

IF OBJECT_ID('dbo.ActivosFijos', 'U') IS NOT NULL
AND COL_LENGTH('dbo.ActivosFijos', 'FechaFactura') IS NULL
BEGIN
  ALTER TABLE dbo.ActivosFijos
    ADD FechaFactura DATE NULL;
END;

IF OBJECT_ID('dbo.ActivosFijos', 'U') IS NOT NULL
AND COL_LENGTH('dbo.ActivosFijos', 'Valor') IS NULL
BEGIN
  ALTER TABLE dbo.ActivosFijos
    ADD Valor DECIMAL(18,2) NULL;
END;

IF OBJECT_ID('dbo.ActivosFijos', 'U') IS NOT NULL
AND COL_LENGTH('dbo.ActivosFijos', 'PropioLeasing') IS NULL
BEGIN
  ALTER TABLE dbo.ActivosFijos
    ADD PropioLeasing NVARCHAR(20) NULL;
END;

IF OBJECT_ID('dbo.ActivosFijos', 'U') IS NOT NULL
AND COL_LENGTH('dbo.ActivosFijos', 'TotalmenteDepreciado') IS NULL
BEGIN
  ALTER TABLE dbo.ActivosFijos
    ADD TotalmenteDepreciado BIT NOT NULL
      CONSTRAINT DF_ActivosFijos_TotalmenteDepreciado DEFAULT (0)
      WITH VALUES;
END;
`;

const ENSURE_ACTIVOS_FIJOS_INDEXES_SQL = `
IF OBJECT_ID('dbo.ActivosFijos', 'U') IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.ActivosFijos')
    AND name = 'IX_ActivosFijos_AF_Id'
)
BEGIN
  CREATE INDEX IX_ActivosFijos_AF_Id
    ON dbo.ActivosFijos(AF ASC, Id DESC)
    INCLUDE (
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
      GrupoContableId,
      CreadoEn,
      ActualizadoEn
    );
END;

IF OBJECT_ID('dbo.ActivosFijos', 'U') IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.ActivosFijos')
    AND name = 'IX_ActivosFijos_TipoActivoId'
)
BEGIN
  CREATE INDEX IX_ActivosFijos_TipoActivoId
    ON dbo.ActivosFijos(TipoActivoId)
    INCLUDE (AF, Descripcion, MarcaId, GrupoContableId);
END;

IF OBJECT_ID('dbo.ActivosFijos', 'U') IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.ActivosFijos')
    AND name = 'IX_ActivosFijos_MarcaId'
)
BEGIN
  CREATE INDEX IX_ActivosFijos_MarcaId
    ON dbo.ActivosFijos(MarcaId)
    INCLUDE (AF, Descripcion, TipoActivoId, GrupoContableId);
END;

IF OBJECT_ID('dbo.ActivosFijos', 'U') IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.ActivosFijos')
    AND name = 'IX_ActivosFijos_GrupoContableId'
)
BEGIN
  CREATE INDEX IX_ActivosFijos_GrupoContableId
    ON dbo.ActivosFijos(GrupoContableId)
    INCLUDE (AF, Descripcion, TipoActivoId, MarcaId);
END;
`;

async function ensureSistemaOtnSchema(pool: sql.ConnectionPool) {
  const hasSistemaOtn = await tableExists(pool, "dbo.SistemaOtn");

  if (!hasSistemaOtn) {
    await runSqlFile(pool, "sql/create-sistema-otn-table.sql");
    return;
  }

  for (const batch of splitSqlBatches(ADD_SISTEMA_OTN_EMPRESA_SQL)) {
    await pool.request().batch(batch);
  }

  for (const batch of splitSqlBatches(ADD_SISTEMA_OTN_ENTREGA_FUENTE_COLUMN_SQL)) {
    await pool.request().batch(batch);
  }

  for (const batch of splitSqlBatches(FIX_SISTEMA_OTN_ENTREGA_FUENTE_SQL)) {
    await pool.request().batch(batch);
  }

  for (const batch of splitSqlBatches(FIX_SISTEMA_OTN_EQUIPO_SQL)) {
    await pool.request().batch(batch);
  }

  for (const batch of splitSqlBatches(ENSURE_SISTEMA_OTN_INDEXES_SQL)) {
    await pool.request().batch(batch);
  }
}

async function ensureSistemaOtnEntregasManualesSchema(pool: sql.ConnectionPool) {
  const hasEntregasManuales = await tableExists(pool, "dbo.SistemaOtnEntregasManuales");

  if (!hasEntregasManuales) {
    await runSqlFile(pool, "sql/create-sistema-otn-entregas-manuales-table.sql");
    return;
  }

  for (const batch of splitSqlBatches(ENSURE_SISTEMA_OTN_ENTREGAS_MANUALES_INDEX_SQL)) {
    await pool.request().batch(batch);
  }
}

async function ensureActivosFijosSchema(pool: sql.ConnectionPool) {
  const hasActivosFijos = await tableExists(pool, "dbo.ActivosFijos");

  if (!hasActivosFijos) {
    await runSqlFile(pool, "sql/create-activos-fijos-table.sql");
    return;
  }

  for (const batch of splitSqlBatches(ENSURE_ACTIVOS_FIJOS_COLUMNS_SQL)) {
    await pool.request().batch(batch);
  }

  for (const batch of splitSqlBatches(ENSURE_ACTIVOS_FIJOS_INDEXES_SQL)) {
    await pool.request().batch(batch);
  }
}

async function ensureCtSupervisoresSchema(pool: sql.ConnectionPool) {
  const hasCtSupervisores = await tableExists(pool, "dbo.CtSupervisores");

  if (!hasCtSupervisores) {
    await runSqlFile(pool, "sql/create-ct-supervisores-table.sql");
    return;
  }

  for (const batch of splitSqlBatches(ENSURE_CT_SUPERVISORES_COLUMNS_SQL)) {
    await pool.request().batch(batch);
  }
}

export async function ensureDatabaseSchema() {
  if (!global.__dbSchemaInit) {
    global.__dbSchemaInit = (async () => {
      const pool = await new sql.ConnectionPool(buildConfig()).connect();

      try {
        const usuariosSql = await fs.readFile(
          path.join(/* turbopackIgnore: true */ process.cwd(), "sql/create-usuarios-table.sql"),
          "utf8",
        );
        for (const batch of splitSqlBatches(usuariosSql)) {
          await pool.request().batch(batch);
        }

        const authSql = await fs.readFile(
          path.join(/* turbopackIgnore: true */ process.cwd(), "sql/create-auth-tables.sql"),
          "utf8",
        );
        for (const batch of splitSqlBatches(authSql)) {
          await pool.request().batch(batch);
        }

        const accessLogsSql = await fs.readFile(
          path.join(
            /* turbopackIgnore: true */ process.cwd(),
            "sql/create-access-logs-table.sql",
          ),
          "utf8",
        );
        for (const batch of splitSqlBatches(accessLogsSql)) {
          await pool.request().batch(batch);
        }

        for (const batch of splitSqlBatches(ENSURE_ACCESS_LOGS_INDEX_SQL)) {
          await pool.request().batch(batch);
        }

        const permissionsSql = await fs.readFile(
          path.join(
            /* turbopackIgnore: true */ process.cwd(),
            "sql/create-permissions-table.sql",
          ),
          "utf8",
        );
        for (const batch of splitSqlBatches(permissionsSql)) {
          await pool.request().batch(batch);
        }

        for (const batch of splitSqlBatches(ENSURE_USUARIOS_INDEX_SQL)) {
          await pool.request().batch(batch);
        }
      } finally {
        await pool.close();
      }
    })();
  }

  await global.__dbSchemaInit;

  if (!global.__dbSchemaActivosFijosInit) {
    global.__dbSchemaActivosFijosInit = (async () => {
      const pool = await new sql.ConnectionPool(buildConfig()).connect();

      try {
        await ensureActivosFijosSchema(pool);
      } finally {
        await pool.close();
      }
    })();
  }

  await global.__dbSchemaActivosFijosInit;

  if (!global.__dbSchemaSistemaOtnInit) {
    global.__dbSchemaSistemaOtnInit = (async () => {
      const pool = await new sql.ConnectionPool(buildConfig()).connect();

      try {
        await ensureSistemaOtnSchema(pool);
      } finally {
        await pool.close();
      }
    })();
  }

  await global.__dbSchemaSistemaOtnInit;

  if (!global.__dbSchemaSistemaOtnAprobacionesInit) {
    global.__dbSchemaSistemaOtnAprobacionesInit = (async () => {
      const pool = await new sql.ConnectionPool(buildConfig()).connect();

      try {
        await ensureSistemaOtnAprobacionesSchema(pool);
      } finally {
        await pool.close();
      }
    })();
  }

  await global.__dbSchemaSistemaOtnAprobacionesInit;

  if (!global.__dbSchemaSistemaOtnEntregasManualesInit) {
    global.__dbSchemaSistemaOtnEntregasManualesInit = (async () => {
      const pool = await new sql.ConnectionPool(buildConfig()).connect();

      try {
        await ensureSistemaOtnEntregasManualesSchema(pool);
      } finally {
        await pool.close();
      }
    })();
  }

  await global.__dbSchemaSistemaOtnEntregasManualesInit;

  if (!global.__dbSchemaCtSupervisoresInit) {
    global.__dbSchemaCtSupervisoresInit = (async () => {
      const pool = await new sql.ConnectionPool(buildConfig()).connect();

      try {
        await ensureCtSupervisoresSchema(pool);
      } finally {
        await pool.close();
      }
    })();
  }

  await global.__dbSchemaCtSupervisoresInit;
}
