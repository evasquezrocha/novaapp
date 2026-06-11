IF OBJECT_ID('dbo.ActivosFijos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ActivosFijos (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ActivosFijos PRIMARY KEY,
    AF NVARCHAR(50) NOT NULL,
    OC NVARCHAR(50) NULL,
    Descripcion NVARCHAR(250) NOT NULL,
    TipoActivoId INT NULL,
    MarcaId INT NULL,
    Modelo NVARCHAR(120) NULL,
    SeriePatente NVARCHAR(120) NULL,
    NumeroFactura NVARCHAR(50) NULL,
    FechaFactura DATE NULL,
    Valor DECIMAL(18,2) NULL,
    PropioLeasing NVARCHAR(20) NULL,
    TotalmenteDepreciado BIT NOT NULL CONSTRAINT DF_ActivosFijos_TotalmenteDepreciado DEFAULT (0),
    Anio INT NULL,
    Observacion NVARCHAR(MAX) NULL,
    GrupoContableId INT NULL,
    CreadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_ActivosFijos_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_ActivosFijos_ActualizadoEn DEFAULT SYSUTCDATETIME()
  );

  CREATE UNIQUE INDEX UX_ActivosFijos_AF
    ON dbo.ActivosFijos(AF);

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

  CREATE INDEX IX_ActivosFijos_TipoActivoId
    ON dbo.ActivosFijos(TipoActivoId)
    INCLUDE (
      AF,
      Descripcion,
      MarcaId,
      GrupoContableId
    );

  CREATE INDEX IX_ActivosFijos_MarcaId
    ON dbo.ActivosFijos(MarcaId)
    INCLUDE (
      AF,
      Descripcion,
      TipoActivoId,
      GrupoContableId
    );

  CREATE INDEX IX_ActivosFijos_GrupoContableId
    ON dbo.ActivosFijos(GrupoContableId)
    INCLUDE (
      AF,
      Descripcion,
      TipoActivoId,
      MarcaId
    );
END;
GO

IF OBJECT_ID('dbo.ActivosFijosTipos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ActivosFijosTipos (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ActivosFijosTipos PRIMARY KEY,
    Nombre NVARCHAR(100) NOT NULL,
    CreadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_ActivosFijosTipos_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_ActivosFijosTipos_ActualizadoEn DEFAULT SYSUTCDATETIME()
  );

  CREATE UNIQUE INDEX UX_ActivosFijosTipos_Nombre
    ON dbo.ActivosFijosTipos(Nombre);
END;
GO

IF OBJECT_ID('dbo.ActivosFijosMarcas', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ActivosFijosMarcas (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ActivosFijosMarcas PRIMARY KEY,
    Nombre NVARCHAR(100) NOT NULL,
    CreadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_ActivosFijosMarcas_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_ActivosFijosMarcas_ActualizadoEn DEFAULT SYSUTCDATETIME()
  );

  CREATE UNIQUE INDEX UX_ActivosFijosMarcas_Nombre
    ON dbo.ActivosFijosMarcas(Nombre);
END;
GO

IF OBJECT_ID('dbo.ActivosFijosGruposContables', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.ActivosFijosGruposContables (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ActivosFijosGruposContables PRIMARY KEY,
    Nombre NVARCHAR(100) NOT NULL,
    CreadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_ActivosFijosGruposContables_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_ActivosFijosGruposContables_ActualizadoEn DEFAULT SYSUTCDATETIME()
  );

  CREATE UNIQUE INDEX UX_ActivosFijosGruposContables_Nombre
    ON dbo.ActivosFijosGruposContables(Nombre);
END;
GO

IF OBJECT_ID('dbo.ActivosFijos', 'U') IS NOT NULL
   AND OBJECT_ID('dbo.ActivosFijosTipos', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.ActivosFijos', 'TipoActivoId') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_ActivosFijos_TipoActivo'
  )
  BEGIN
    ALTER TABLE dbo.ActivosFijos
      ADD CONSTRAINT FK_ActivosFijos_TipoActivo
      FOREIGN KEY (TipoActivoId) REFERENCES dbo.ActivosFijosTipos(Id);
  END;
END;
GO

IF OBJECT_ID('dbo.ActivosFijos', 'U') IS NOT NULL
   AND OBJECT_ID('dbo.ActivosFijosMarcas', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.ActivosFijos', 'MarcaId') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_ActivosFijos_Marca'
  )
  BEGIN
    ALTER TABLE dbo.ActivosFijos
      ADD CONSTRAINT FK_ActivosFijos_Marca
      FOREIGN KEY (MarcaId) REFERENCES dbo.ActivosFijosMarcas(Id);
  END;
END;
GO

IF OBJECT_ID('dbo.ActivosFijos', 'U') IS NOT NULL
   AND OBJECT_ID('dbo.ActivosFijosGruposContables', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.ActivosFijos', 'GrupoContableId') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_ActivosFijos_GrupoContable'
  )
  BEGIN
    ALTER TABLE dbo.ActivosFijos
      ADD CONSTRAINT FK_ActivosFijos_GrupoContable
      FOREIGN KEY (GrupoContableId) REFERENCES dbo.ActivosFijosGruposContables(Id);
  END;
END;
GO
