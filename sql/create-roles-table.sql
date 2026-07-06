IF OBJECT_ID('dbo.Roles', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Roles (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Roles PRIMARY KEY,
    Nombre NVARCHAR(50) NOT NULL,
    EsSistema BIT NOT NULL CONSTRAINT DF_Roles_EsSistema DEFAULT (0),
    Orden INT NOT NULL CONSTRAINT DF_Roles_Orden DEFAULT (0),
    CreadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_Roles_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_Roles_ActualizadoEn DEFAULT SYSUTCDATETIME()
  );

  CREATE UNIQUE INDEX UX_Roles_Nombre
    ON dbo.Roles(Nombre);
END;
GO

IF OBJECT_ID('dbo.Roles', 'U') IS NOT NULL
BEGIN
  ;WITH SeedRoles AS (
    SELECT N'Administrador' AS Nombre, CAST(1 AS BIT) AS EsSistema, 1 AS Orden
    UNION ALL SELECT N'Supervisor', CAST(1 AS BIT), 2
    UNION ALL SELECT N'Operador', CAST(1 AS BIT), 3
    UNION ALL SELECT N'Usuario', CAST(1 AS BIT), 4
    UNION ALL SELECT N'RRHH', CAST(1 AS BIT), 5
    UNION ALL SELECT N'Gerencia', CAST(1 AS BIT), 6
  )
  INSERT INTO dbo.Roles (Nombre, EsSistema, Orden)
  SELECT seed.Nombre, seed.EsSistema, seed.Orden
  FROM SeedRoles AS seed
  WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.Roles AS roles
    WHERE roles.Nombre = seed.Nombre
  );
END;
GO
