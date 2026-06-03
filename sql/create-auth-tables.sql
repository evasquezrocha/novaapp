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
