DECLARE @Nombre NVARCHAR(150) = N'Administrador';
DECLARE @Usuario NVARCHAR(80) = N'evasquezrocha';
DECLARE @Correo NVARCHAR(255) = N'evasquezrocha@gmail.com';
DECLARE @Rol NVARCHAR(50) = N'Administrador';
DECLARE @Activo BIT = 1;
DECLARE @PasswordSalt VARBINARY(32) = 0x001b2859e080db6cb93e2bc42e8c54bc636054e9da6f47e40e9f92da8bed5940;
DECLARE @PasswordHash VARBINARY(64) = 0x50e007536d3bdf8fc8c521f2890eded15147743dbdeb222da56dbd7431af7bc31c29d3c1a3ca7b55037ba1c0ae5dc3dc2ef764ff0851bda001024420f0057efd;

IF EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Usuario = @Usuario OR Correo = @Correo)
BEGIN
  UPDATE dbo.Usuarios
  SET
    Nombre = @Nombre,
    Usuario = @Usuario,
    Correo = @Correo,
    Rol = @Rol,
    Activo = @Activo,
    PasswordSalt = @PasswordSalt,
    PasswordHash = @PasswordHash,
    ActualizadoEn = SYSUTCDATETIME()
  WHERE Usuario = @Usuario OR Correo = @Correo;
END
ELSE
BEGIN
  INSERT INTO dbo.Usuarios
    (Nombre, Usuario, Correo, Rol, Activo, PasswordSalt, PasswordHash)
  VALUES
    (@Nombre, @Usuario, @Correo, @Rol, @Activo, @PasswordSalt, @PasswordHash);
END
GO
