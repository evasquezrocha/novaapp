IF OBJECT_ID('dbo.CtSupervisores', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CtSupervisores (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CtSupervisores PRIMARY KEY,
    Correlativo NVARCHAR(50) NOT NULL CONSTRAINT DF_CtSupervisores_Correlativo DEFAULT (''),
    Estado NVARCHAR(50) NOT NULL CONSTRAINT DF_CtSupervisores_Estado DEFAULT (N'Ingresado'),
    Nombre NVARCHAR(150) NOT NULL,
    Lugar NVARCHAR(150) NOT NULL,
    Entrada DATETIME2(0) NOT NULL,
    Salida DATETIME2(0) NOT NULL,
    Dias DECIMAL(4,2) NOT NULL,
    CreadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_CtSupervisores_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_CtSupervisores_ActualizadoEn DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_CtSupervisores_CreadoEn_Id
    ON dbo.CtSupervisores(CreadoEn DESC, Id DESC)
    INCLUDE (Correlativo, Estado, Nombre, Lugar, Entrada, Salida, Dias);
END;
GO
