IF OBJECT_ID('dbo.PerfilesTP', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PerfilesTP (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PerfilesTP PRIMARY KEY,
    Empresa NVARCHAR(MAX) NOT NULL,
    Logo NVARCHAR(MAX) NULL,
    Nombre NVARCHAR(MAX) NOT NULL,
    Contacto NVARCHAR(MAX) NULL,
    WhatsApp NVARCHAR(MAX) NULL,
    Telefono NVARCHAR(MAX) NULL,
    Web NVARCHAR(MAX) NULL,
    Instagram NVARCHAR(MAX) NULL,
    LinkedIn NVARCHAR(MAX) NULL,
    Transferencia NVARCHAR(MAX) NULL,
    CodigoAleatorio NVARCHAR(50) NOT NULL,
    CreadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_PerfilesTP_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_PerfilesTP_ActualizadoEn DEFAULT SYSUTCDATETIME()
  );

  CREATE UNIQUE INDEX UX_PerfilesTP_CodigoAleatorio
    ON dbo.PerfilesTP(CodigoAleatorio);

  CREATE INDEX IX_PerfilesTP_CreadoEn_Id
    ON dbo.PerfilesTP(CreadoEn DESC, Id DESC)
    INCLUDE (Empresa, Nombre, CodigoAleatorio);
END;
GO
