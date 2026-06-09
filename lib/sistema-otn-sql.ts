import sql from "mssql";
import { ensureDatabaseSchema } from "@/lib/db-schema";
import { getAuthPool } from "@/lib/auth-sql";
import { getSistemaOtnAprobacionesRowsByOtn } from "@/lib/sistema-otn-aprobaciones-sql";
import { listSistemaOtnEntregasManualesRowsByOtn } from "@/lib/sistema-otn-entregas-manuales-sql";
import {
  getMaterialesUtilizadosByOtn,
  getSalesCreditNotesByOtn,
  getSalesInvoicesByOtn,
} from "@/lib/sap-stock";
import { resolveSapCompanyKeyFromEmpresa } from "@/lib/company-config";
import { getSistemaOtnEstado } from "@/lib/sistema-otn-estado";

export type SistemaOtnRow = {
  Id: number;
  OTN: string;
  Estado: string | null;
  EstadoDerivado?: string | null;
  EntregaFuente?: string | null;
  TotalPresupuesto?: number | null;
  TotalAprobado?: number | null;
  TotalEntregado?: number | null;
  TotalFacturado?: number | null;
  TotalNotasCredito?: number | null;
  TotalPendiente?: number | null;
  FechaIngreso: string | null;
  Cliente: string | null;
  Empresa: string | null;
  Solicitante: string | null;
  CC: string | null;
  Cantidad: number | null;
  Descripcion: string | null;
  ReferenciaCliente: string | null;
  Cotizador: string | null;
  Equipo: string | null;
  FechaPpto: string | null;
  ValorPpto: number | null;
  Plazo: string | null;
  Observaciones: string | null;
  Ruta: string | null;
  CreadoEn: string;
  ActualizadoEn: string;
};

export type SistemaOtnInput = {
  OTN: string;
  Estado?: string | null;
  EntregaFuente?: string | null;
  FechaIngreso?: string | null;
  Cliente?: string | null;
  Empresa?: string | null;
  Solicitante?: string | null;
  CC?: string | null;
  Cantidad?: number | null;
  Descripcion?: string | null;
  ReferenciaCliente?: string | null;
  Cotizador?: string | null;
  Equipo?: string | null;
  FechaPpto?: string | null;
  ValorPpto?: number | null;
  Plazo?: string | null;
  Observaciones?: string | null;
  Ruta?: string | null;
};

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeEstado(value: string | null | undefined) {
  return normalizeText(value) ?? "Ingresado";
}

function normalizeEntregaFuente(value: string | null | undefined) {
  return value?.trim().toLowerCase() === "manual" ? "manual" : "sap";
}

function normalizeEquipo(value: string | null | undefined) {
  return value?.trim().toLowerCase() === "no" ? "No" : "Sí";
}

function normalizeEmpresa(value: string | null | undefined) {
  return normalizeText(value);
}

function normalizeDate(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeRow(row: SistemaOtnRow): SistemaOtnRow {
  return {
    ...row,
    FechaIngreso: row.FechaIngreso ?? null,
    Estado: row.Estado ?? null,
    EntregaFuente: normalizeEntregaFuente(row.EntregaFuente),
    TotalPresupuesto: row.TotalPresupuesto ?? null,
    TotalAprobado: row.TotalAprobado ?? null,
    TotalEntregado: row.TotalEntregado ?? null,
    TotalFacturado: row.TotalFacturado ?? null,
    TotalNotasCredito: row.TotalNotasCredito ?? null,
    TotalPendiente: row.TotalPendiente ?? null,
    Cliente: row.Cliente ?? null,
    Empresa: row.Empresa ?? null,
    Solicitante: row.Solicitante ?? null,
    CC: row.CC ?? null,
    Cantidad: row.Cantidad ?? null,
    Descripcion: row.Descripcion ?? null,
    ReferenciaCliente: row.ReferenciaCliente ?? null,
    Cotizador: row.Cotizador ?? null,
    Equipo: normalizeEquipo(row.Equipo),
    FechaPpto: row.FechaPpto ?? null,
    ValorPpto: row.ValorPpto ?? null,
    Plazo: row.Plazo ?? null,
    Observaciones: row.Observaciones ?? null,
    Ruta: row.Ruta ?? null,
  };
}

async function getPool() {
  await ensureDatabaseSchema();
  return getAuthPool();
}

async function ensureEmpresaColumn(pool: sql.ConnectionPool) {
  const result = await pool.request().query<{ HasEmpresa: number }>(`
    SELECT CASE
      WHEN COL_LENGTH('dbo.SistemaOtn', 'Empresa') IS NULL THEN 0
      ELSE 1
    END AS HasEmpresa
  `);

  const hasEmpresa = Boolean(result.recordset[0]?.HasEmpresa);

  if (!hasEmpresa) {
    await pool.request().batch(`
      ALTER TABLE dbo.SistemaOtn
        ADD Empresa NVARCHAR(50) NULL;
    `);
  }

  return true;
}

async function ensureEntregaFuenteColumn(pool: sql.ConnectionPool) {
  const result = await pool.request().query<{ HasEntregaFuente: number }>(`
    SELECT CASE
      WHEN COL_LENGTH('dbo.SistemaOtn', 'EntregaFuente') IS NULL THEN 0
      ELSE 1
    END AS HasEntregaFuente
  `);

  return Boolean(result.recordset[0]?.HasEntregaFuente);
}

async function getSistemaOtnTotales(
  otn: string,
  totalPresupuesto: number | null | undefined,
  empresa?: string | null,
  entregaFuente?: string | null,
) {
  const companyKey = resolveSapCompanyKeyFromEmpresa(empresa);
  const [aprobaciones, materialesUtilizados, entregasManuales, facturas, notasCredito] =
    await Promise.all([
    getSistemaOtnAprobacionesRowsByOtn(otn),
    getMaterialesUtilizadosByOtn(otn, companyKey),
    listSistemaOtnEntregasManualesRowsByOtn(otn),
    getSalesInvoicesByOtn(otn, companyKey),
    getSalesCreditNotesByOtn(otn, companyKey),
  ]);

  const totalAprobado = aprobaciones.reduce((sum, row) => sum + (row.ValorAprobado ?? 0), 0);
  const totalEntregadoSap = materialesUtilizados.total;
  const totalEntregadoManual = entregasManuales.reduce(
    (sum, row) => sum + (row.ValorEntrega ?? 0),
    0,
  );
  const totalEntregado = normalizeEntregaFuente(entregaFuente) === "manual"
    ? totalEntregadoManual
    : totalEntregadoSap;
  const totalFacturado = facturas.rows.reduce((sum, row) => sum + (row.Total ?? 0), 0);
  const totalNotasCredito = notasCredito.rows.reduce((sum, row) => sum + (row.TotalNeto ?? 0), 0);
  const totalPendiente = facturas.rows.reduce(
    (sum, row) => sum + (row.TotalPendiente ?? 0),
    0,
  );
  const estadoDerivado = getSistemaOtnEstado({
    totalPresupuesto: totalPresupuesto ?? 0,
    totalAprobado,
    totalEntregado,
    totalFacturado,
    totalNotasCredito,
    totalFacturadoPendiente: totalPendiente,
  });

  return {
    estadoDerivado,
    totalPresupuesto: totalPresupuesto ?? 0,
    totalAprobado,
    totalEntregado,
    totalFacturado,
    totalNotasCredito,
    totalPendiente,
  };
}

export async function listSistemaOtnRows(): Promise<SistemaOtnRow[]> {
  const pool = await getPool();
  const includeEmpresa = await ensureEmpresaColumn(pool);
  const includeEntregaFuente = await ensureEntregaFuenteColumn(pool);

  const result = await pool.request().query<SistemaOtnRow>(`
    SELECT
      Id,
      OTN,
      Estado,
      CONVERT(varchar(10), FechaIngreso, 23) AS FechaIngreso,
      Cliente,
      ${includeEmpresa ? "Empresa" : "CAST(NULL AS NVARCHAR(50)) AS Empresa"},
      ${includeEntregaFuente ? "EntregaFuente" : "CAST(NULL AS NVARCHAR(10)) AS EntregaFuente"},
      Solicitante,
      CC,
      Cantidad,
      Descripcion,
      ReferenciaCliente,
      Cotizador,
      Equipo,
      CONVERT(varchar(10), FechaPpto, 23) AS FechaPpto,
      ValorPpto,
      Plazo,
      Observaciones,
      Ruta,
      CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
      CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
    FROM dbo.SistemaOtn
    ORDER BY Id DESC
  `);

  const rows = result.recordset.map(normalizeRow);

  return Promise.all(
    rows.map(async (row) => {
      const totals = await getSistemaOtnTotales(
        row.OTN,
        row.ValorPpto,
        row.Empresa,
        row.EntregaFuente,
      );

      return {
        ...row,
        EstadoDerivado: totals.estadoDerivado,
        TotalPresupuesto: totals.totalPresupuesto,
        TotalAprobado: totals.totalAprobado,
        TotalEntregado: totals.totalEntregado,
        TotalFacturado: totals.totalFacturado,
        TotalNotasCredito: totals.totalNotasCredito,
        TotalPendiente: totals.totalPendiente,
      };
    }),
  ).then((decoratedRows) =>
    decoratedRows.map((row) => ({
      ...row,
      Estado: row.EstadoDerivado ?? row.Estado ?? "Ingresado",
    })),
  );
}

export async function getSistemaOtnRowById(id: number): Promise<SistemaOtnRow | null> {
  const pool = await getPool();
  const includeEmpresa = await ensureEmpresaColumn(pool);
  const includeEntregaFuente = await ensureEntregaFuenteColumn(pool);

  const result = await pool
    .request()
    .query<SistemaOtnRow>(`
      SELECT TOP 1
        Id,
        OTN,
        Estado,
        CONVERT(varchar(10), FechaIngreso, 23) AS FechaIngreso,
        Cliente,
        ${includeEmpresa ? "Empresa" : "CAST(NULL AS NVARCHAR(50)) AS Empresa"},
        ${includeEntregaFuente ? "EntregaFuente" : "CAST(NULL AS NVARCHAR(10)) AS EntregaFuente"},
        Solicitante,
        CC,
        Cantidad,
        Descripcion,
        ReferenciaCliente,
        Cotizador,
        Equipo,
        CONVERT(varchar(10), FechaPpto, 23) AS FechaPpto,
        ValorPpto,
        Plazo,
        Observaciones,
        Ruta,
        CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
        CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
      FROM dbo.SistemaOtn
      WHERE Id = ${id}
    `);

  return result.recordset[0] ? normalizeRow(result.recordset[0]) : null;
}

export async function getSistemaOtnRowByOtn(otn: string): Promise<SistemaOtnRow | null> {
  const normalizedOtn = otn.trim();
  if (!normalizedOtn) {
    return null;
  }

  const pool = await getPool();
  const includeEmpresa = await ensureEmpresaColumn(pool);
  const includeEntregaFuente = await ensureEntregaFuenteColumn(pool);

  const result = await pool
    .request()
    .input("otn", normalizedOtn)
    .query<SistemaOtnRow>(`
      SELECT TOP 1
        Id,
        OTN,
        Estado,
        CONVERT(varchar(10), FechaIngreso, 23) AS FechaIngreso,
        Cliente,
        ${includeEmpresa ? "Empresa" : "CAST(NULL AS NVARCHAR(50)) AS Empresa"},
        ${includeEntregaFuente ? "EntregaFuente" : "CAST(NULL AS NVARCHAR(10)) AS EntregaFuente"},
        Solicitante,
        CC,
        Cantidad,
        Descripcion,
        ReferenciaCliente,
        Cotizador,
        Equipo,
        CONVERT(varchar(10), FechaPpto, 23) AS FechaPpto,
        ValorPpto,
        Plazo,
        Observaciones,
        Ruta,
        CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
        CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
      FROM dbo.SistemaOtn
      WHERE OTN = @otn
    `);

  return result.recordset[0] ? normalizeRow(result.recordset[0]) : null;
}

export async function createSistemaOtnRow(input: SistemaOtnInput) {
  const pool = await getPool();
  const includeEmpresa = await ensureEmpresaColumn(pool);

  if (includeEmpresa) {
    await pool
      .request()
      .input("otn", input.OTN.trim())
      .input("estado", normalizeEstado(input.Estado))
      .input("entregaFuente", normalizeEntregaFuente(input.EntregaFuente))
      .input("fechaIngreso", normalizeDate(input.FechaIngreso))
      .input("cliente", normalizeText(input.Cliente))
      .input("empresa", normalizeEmpresa(input.Empresa))
      .input("solicitante", normalizeText(input.Solicitante))
      .input("cc", normalizeText(input.CC))
      .input("cantidad", normalizeNumber(input.Cantidad))
      .input("descripcion", normalizeText(input.Descripcion))
      .input("referenciaCliente", normalizeText(input.ReferenciaCliente))
      .input("cotizador", normalizeText(input.Cotizador))
      .input("equipo", normalizeEquipo(input.Equipo))
      .input("fechaPpto", normalizeDate(input.FechaPpto))
      .input("valorPpto", normalizeNumber(input.ValorPpto))
      .input("plazo", normalizeText(input.Plazo))
      .input("observaciones", normalizeText(input.Observaciones))
      .input("ruta", normalizeText(input.Ruta))
      .query(`
        INSERT INTO dbo.SistemaOtn
          (
            OTN,
            Estado,
            EntregaFuente,
            FechaIngreso,
            Cliente,
            Empresa,
            Solicitante,
            CC,
            Cantidad,
            Descripcion,
            ReferenciaCliente,
            Cotizador,
            Equipo,
            FechaPpto,
            ValorPpto,
            Plazo,
            Observaciones,
            Ruta
          )
        VALUES
          (
            @otn,
            @estado,
            @entregaFuente,
            NULLIF(@fechaIngreso, ''),
            @cliente,
            @empresa,
            @solicitante,
            @cc,
            @cantidad,
            @descripcion,
            @referenciaCliente,
            @cotizador,
            @equipo,
            NULLIF(@fechaPpto, ''),
            @valorPpto,
            @plazo,
            @observaciones,
            @ruta
          )
      `);

    return;
  }

  await pool
    .request()
    .input("otn", input.OTN.trim())
    .input("estado", normalizeEstado(input.Estado))
    .input("entregaFuente", normalizeEntregaFuente(input.EntregaFuente))
    .input("fechaIngreso", normalizeDate(input.FechaIngreso))
    .input("cliente", normalizeText(input.Cliente))
    .input("solicitante", normalizeText(input.Solicitante))
    .input("cc", normalizeText(input.CC))
    .input("cantidad", normalizeNumber(input.Cantidad))
    .input("descripcion", normalizeText(input.Descripcion))
    .input("referenciaCliente", normalizeText(input.ReferenciaCliente))
    .input("cotizador", normalizeText(input.Cotizador))
    .input("equipo", normalizeEquipo(input.Equipo))
    .input("fechaPpto", normalizeDate(input.FechaPpto))
    .input("valorPpto", normalizeNumber(input.ValorPpto))
    .input("plazo", normalizeText(input.Plazo))
    .input("observaciones", normalizeText(input.Observaciones))
    .input("ruta", normalizeText(input.Ruta))
    .query(`
      INSERT INTO dbo.SistemaOtn
        (
          OTN,
          Estado,
          EntregaFuente,
          FechaIngreso,
          Cliente,
          Solicitante,
          CC,
          Cantidad,
          Descripcion,
          ReferenciaCliente,
          Cotizador,
          Equipo,
          FechaPpto,
          ValorPpto,
          Plazo,
          Observaciones,
          Ruta
        )
      VALUES
        (
          @otn,
          @estado,
          @entregaFuente,
          NULLIF(@fechaIngreso, ''),
          @cliente,
          @solicitante,
          @cc,
          @cantidad,
          @descripcion,
          @referenciaCliente,
          @cotizador,
          @equipo,
          NULLIF(@fechaPpto, ''),
          @valorPpto,
          @plazo,
          @observaciones,
          @ruta
        )
    `);
}

export async function updateSistemaOtnRow(id: number, input: SistemaOtnInput) {
  const pool = await getPool();
  const includeEmpresa = await ensureEmpresaColumn(pool);

  if (includeEmpresa) {
    await pool
      .request()
      .input("otn", input.OTN.trim())
      .input("estado", normalizeEstado(input.Estado))
      .input("entregaFuente", normalizeEntregaFuente(input.EntregaFuente))
      .input("fechaIngreso", normalizeDate(input.FechaIngreso))
      .input("cliente", normalizeText(input.Cliente))
      .input("empresa", normalizeEmpresa(input.Empresa))
      .input("solicitante", normalizeText(input.Solicitante))
      .input("cc", normalizeText(input.CC))
      .input("cantidad", normalizeNumber(input.Cantidad))
      .input("descripcion", normalizeText(input.Descripcion))
      .input("referenciaCliente", normalizeText(input.ReferenciaCliente))
      .input("cotizador", normalizeText(input.Cotizador))
      .input("equipo", normalizeEquipo(input.Equipo))
      .input("fechaPpto", normalizeDate(input.FechaPpto))
      .input("valorPpto", normalizeNumber(input.ValorPpto))
      .input("plazo", normalizeText(input.Plazo))
      .input("observaciones", normalizeText(input.Observaciones))
      .input("ruta", normalizeText(input.Ruta))
      .query(`
        UPDATE dbo.SistemaOtn
        SET
          OTN = @otn,
          Estado = @estado,
          EntregaFuente = @entregaFuente,
          FechaIngreso = NULLIF(@fechaIngreso, ''),
          Cliente = @cliente,
          Empresa = @empresa,
          Solicitante = @solicitante,
          CC = @cc,
          Cantidad = @cantidad,
          Descripcion = @descripcion,
          ReferenciaCliente = @referenciaCliente,
          Cotizador = @cotizador,
          Equipo = @equipo,
          FechaPpto = NULLIF(@fechaPpto, ''),
          ValorPpto = @valorPpto,
          Plazo = @plazo,
          Observaciones = @observaciones,
          Ruta = @ruta,
          ActualizadoEn = SYSUTCDATETIME()
        WHERE Id = ${id}
      `);

    return;
  }

  await pool
    .request()
    .input("otn", input.OTN.trim())
    .input("estado", normalizeEstado(input.Estado))
    .input("entregaFuente", normalizeEntregaFuente(input.EntregaFuente))
    .input("fechaIngreso", normalizeDate(input.FechaIngreso))
    .input("cliente", normalizeText(input.Cliente))
    .input("solicitante", normalizeText(input.Solicitante))
    .input("cc", normalizeText(input.CC))
    .input("cantidad", normalizeNumber(input.Cantidad))
    .input("descripcion", normalizeText(input.Descripcion))
    .input("referenciaCliente", normalizeText(input.ReferenciaCliente))
    .input("cotizador", normalizeText(input.Cotizador))
    .input("equipo", normalizeEquipo(input.Equipo))
    .input("fechaPpto", normalizeDate(input.FechaPpto))
    .input("valorPpto", normalizeNumber(input.ValorPpto))
    .input("plazo", normalizeText(input.Plazo))
    .input("observaciones", normalizeText(input.Observaciones))
    .input("ruta", normalizeText(input.Ruta))
    .query(`
      UPDATE dbo.SistemaOtn
      SET
        OTN = @otn,
        Estado = @estado,
        EntregaFuente = @entregaFuente,
        FechaIngreso = NULLIF(@fechaIngreso, ''),
        Cliente = @cliente,
        Solicitante = @solicitante,
        CC = @cc,
        Cantidad = @cantidad,
        Descripcion = @descripcion,
        ReferenciaCliente = @referenciaCliente,
        Cotizador = @cotizador,
        Equipo = @equipo,
        FechaPpto = NULLIF(@fechaPpto, ''),
        ValorPpto = @valorPpto,
        Plazo = @plazo,
        Observaciones = @observaciones,
        Ruta = @ruta,
        ActualizadoEn = SYSUTCDATETIME()
      WHERE Id = ${id}
    `);
}

export async function deleteSistemaOtnRow(id: number) {
  const pool = await getPool();
  await pool
    .request()
    .query(`DELETE FROM dbo.SistemaOtn WHERE Id = ${id}`);
}
