IF OBJECT_ID('dbo.CtSupervisoresHistorial', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CtSupervisoresHistorial (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CtSupervisoresHistorial PRIMARY KEY,
    Correlativo NVARCHAR(50) NOT NULL,
    Accion NVARCHAR(20) NOT NULL,
    EditadoPorUsuario NVARCHAR(100) NOT NULL,
    EditadoPorNombre NVARCHAR(150) NOT NULL,
    EditadoPorRol NVARCHAR(50) NOT NULL,
    CambiosJson NVARCHAR(MAX) NOT NULL,
    EditadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_CtSupervisoresHistorial_EditadoEn DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_CtSupervisoresHistorial_Correlativo_EditadoEn_Id
    ON dbo.CtSupervisoresHistorial(Correlativo ASC, EditadoEn DESC, Id DESC);
END;
GO
