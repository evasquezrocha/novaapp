IF OBJECT_ID('dbo.SistemaOtnEntregasManuales', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.SistemaOtnEntregasManuales (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SistemaOtnEntregasManuales PRIMARY KEY,
    OTN NVARCHAR(50) NOT NULL,
    FechaEntrega DATE NOT NULL,
    ValorEntrega DECIMAL(18,2) NOT NULL,
    ReferenciaEntrega NVARCHAR(150) NULL,
    CreadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_SistemaOtnEntregasManuales_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_SistemaOtnEntregasManuales_ActualizadoEn DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_SistemaOtnEntregasManuales_OTN_FechaEntrega_Id
    ON dbo.SistemaOtnEntregasManuales(OTN, FechaEntrega DESC, Id DESC)
    INCLUDE (ValorEntrega, ReferenciaEntrega, CreadoEn, ActualizadoEn);
END;
