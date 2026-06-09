IF OBJECT_ID('dbo.SistemaOtn', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.SistemaOtn (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SistemaOtn PRIMARY KEY,
    OTN NVARCHAR(50) NOT NULL,
    Estado NVARCHAR(60) NOT NULL CONSTRAINT DF_SistemaOtn_Estado DEFAULT N'Ingresado',
    FechaIngreso DATE NULL,
    Cliente NVARCHAR(150) NULL,
    Empresa NVARCHAR(50) NULL,
    EntregaFuente NVARCHAR(10) NOT NULL CONSTRAINT DF_SistemaOtn_EntregaFuente DEFAULT N'sap',
    Solicitante NVARCHAR(150) NULL,
    CC NVARCHAR(80) NULL,
    Cantidad DECIMAL(18,2) NULL,
    Descripcion NVARCHAR(500) NULL,
    ReferenciaCliente NVARCHAR(150) NULL,
    Cotizador NVARCHAR(150) NULL,
    Equipo NVARCHAR(150) NOT NULL CONSTRAINT DF_SistemaOtn_Equipo DEFAULT N'Sí',
    FechaPpto DATE NULL,
    ValorPpto DECIMAL(18,2) NULL,
    Plazo NVARCHAR(100) NULL,
    Observaciones NVARCHAR(MAX) NULL,
    Ruta NVARCHAR(255) NULL,
    CreadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_SistemaOtn_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_SistemaOtn_ActualizadoEn DEFAULT SYSUTCDATETIME()
  );

  CREATE UNIQUE INDEX UX_SistemaOtn_OTN
    ON dbo.SistemaOtn(OTN);
END;
