IF OBJECT_ID('dbo.AccesosLog', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AccesosLog (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AccesosLog PRIMARY KEY,
    UsuarioId INT NOT NULL,
    Usuario NVARCHAR(80) NOT NULL,
    Nombre NVARCHAR(150) NOT NULL,
    DireccionIp NVARCHAR(45) NULL,
    AccedidoEn DATETIME2(0) NOT NULL CONSTRAINT DF_AccesosLog_AccedidoEn DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_AccesosLog_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(Id) ON DELETE CASCADE
  );

  CREATE INDEX IX_AccesosLog_AccedidoEn_Id
    ON dbo.AccesosLog(AccedidoEn DESC, Id DESC)
    INCLUDE (UsuarioId, Usuario, Nombre, DireccionIp);
  CREATE INDEX IX_AccesosLog_UsuarioId ON dbo.AccesosLog(UsuarioId);
END;
GO
