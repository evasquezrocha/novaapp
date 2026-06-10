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
