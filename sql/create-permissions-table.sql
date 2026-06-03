IF OBJECT_ID('dbo.Permisos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Permisos (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Permisos PRIMARY KEY,
    Rol NVARCHAR(50) NOT NULL,
    Modulo NVARCHAR(50) NOT NULL,
    Accion NVARCHAR(50) NOT NULL,
    Permitido BIT NOT NULL CONSTRAINT DF_Permisos_Permitido DEFAULT (0),
    CreadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_Permisos_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_Permisos_ActualizadoEn DEFAULT SYSUTCDATETIME()
  );

  CREATE UNIQUE INDEX UX_Permisos_Rol_Modulo_Accion
    ON dbo.Permisos(Rol, Modulo, Accion);
END;
GO
