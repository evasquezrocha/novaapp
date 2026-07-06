IF OBJECT_ID('dbo.Sesiones', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Sesiones (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Sesiones PRIMARY KEY,
    TokenHash VARBINARY(32) NOT NULL,
    UsuarioId INT NOT NULL,
    CreadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_Sesiones_CreadoEn DEFAULT SYSUTCDATETIME(),
    ExpiraEn DATETIME2(0) NOT NULL,
    RevocadoEn DATETIME2(0) NULL,
    UltimoAccesoEn DATETIME2(0) NOT NULL CONSTRAINT DF_Sesiones_UltimoAccesoEn DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Sesiones_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(Id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX UX_Sesiones_TokenHash ON dbo.Sesiones(TokenHash);
  CREATE INDEX IX_Sesiones_UsuarioId ON dbo.Sesiones(UsuarioId);
  CREATE INDEX IX_Sesiones_ExpiraEn ON dbo.Sesiones(ExpiraEn);
END;
GO

IF OBJECT_ID('dbo.LoginIntentos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.LoginIntentos (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LoginIntentos PRIMARY KEY,
    Usuario NVARCHAR(100) NOT NULL,
    DireccionIp NVARCHAR(45) NOT NULL,
    IntentosFallidos INT NOT NULL CONSTRAINT DF_LoginIntentos_IntentosFallidos DEFAULT (0),
    PrimeraFallaEn DATETIME2(0) NULL,
    UltimaFallaEn DATETIME2(0) NULL,
    BloqueadoHasta DATETIME2(0) NULL,
    CreadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_LoginIntentos_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn DATETIME2(0) NOT NULL CONSTRAINT DF_LoginIntentos_ActualizadoEn DEFAULT SYSUTCDATETIME()
  );

  CREATE UNIQUE INDEX UX_LoginIntentos_Usuario_DireccionIp
    ON dbo.LoginIntentos(Usuario, DireccionIp);
  CREATE INDEX IX_LoginIntentos_BloqueadoHasta
    ON dbo.LoginIntentos(BloqueadoHasta)
    INCLUDE (Usuario, DireccionIp, IntentosFallidos, PrimeraFallaEn, UltimaFallaEn);
END;
GO
