import sql from "mssql";
import { cookies } from "next/headers";
import {
  COMPANY_COOKIE_NAME,
  SAP_COMPANIES,
  isSapCompanyKey,
  type SapCompanyConfig,
  type SapCompanyKey,
} from "@/lib/company-config";

export type StockActualRow = {
  Codigo: string;
  Descripcion: string;
  Unidad: string;
  Bodega: string;
  "Stock Actual": number;
  Pedido: number;
  "Stock Minimo": number;
};

export type OpenPurchaseOrderRow = {
  NumeroOC: number;
  FechaEmision: string;
  FechaEntrega: string;
  NombreProveedor: string;
  SlpName: string;
  CantidadTotal: number;
  CantidadPendiente: number;
  ValorUnitario: number;
  ValorTotal: number;
};

export type ProjectBudgetRow = {
  MATPPTO: number | null;
  SERVPPTO: number | null;
  DESCRIPCION: string;
};

export type MaterialesUtilizadosRow = {
  Documento: number;
  Fecha: string;
  Codigo: string;
  Descripcion: string;
  Cantidad: number;
  PrecioUnitario: number;
  TotalLinea: number;
};

export type MaterialesUtilizadosResult = {
  total: number;
  rows: MaterialesUtilizadosRow[];
};

export type MaterialesDevueltosRow = {
  Documento: number;
  Fecha: string;
  Codigo: string;
  Descripcion: string;
  Cantidad: number;
  PrecioUnitario: number;
  TotalLinea: number;
};

export type MaterialesDevueltosResult = {
  total: number;
  rows: MaterialesDevueltosRow[];
};

export type ServiciosSinOcRow = {
  Documento: number;
  Fecha: string;
  Proveedor: string;
  Descripcion: string;
  TotalLinea: number;
};

export type ServiciosSinOcResult = {
  total: number;
  rows: ServiciosSinOcRow[];
};

export type ServiciosUtilizadosRow = {
  Documento: number;
  Fecha: string;
  Proveedor: string;
  Descripcion: string;
  TotalLinea: number;
};

export type ServiciosUtilizadosResult = {
  total: number;
  rows: ServiciosUtilizadosRow[];
};

export type NcServiciosRow = {
  Documento: number;
  Fecha: string;
  Proveedor: string;
  Descripcion: string;
  TotalLinea: number;
};

export type NcServiciosResult = {
  total: number;
  rows: NcServiciosRow[];
};

export type AsientosDirectosRow = {
  Numero: number;
  Fecha: string;
  BaseRef: string;
  Cuenta: string;
  NombreCuenta: string;
  Debe: number;
  Haber: number;
  Proyecto: string;
  ProfitCode: string;
  Memo: string;
  Linea: number;
  Saldo: number;
  TipoTransaccion: number;
};

export type AsientosDirectosResult = {
  total: number;
  rows: AsientosDirectosRow[];
};

export type FondosRendidosRow = {
  NumeroPago: number;
  FechaPago: string;
  EnFavorDe: string;
  Cuenta: string;
  Descripcion: string;
  Monto: number;
};

export type FondosRendidosResult = {
  total: number;
  rows: FondosRendidosRow[];
};

type SqlEnv = {
  user: string;
  password: string;
  server: string;
  port: number;
  database: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
  };
  pool: {
    max: number;
    min: number;
    idleTimeoutMillis: number;
  };
};

declare global {
  var __sapStockPools:
    | Partial<Record<SapCompanyKey, Promise<sql.ConnectionPool>>>
    | undefined;
}

function isMissingObjectError(error: unknown) {
  return (
    error instanceof Error &&
    "number" in error &&
    typeof (error as { number?: unknown }).number === "number" &&
    (error as { number: number }).number === 208
  );
}

export async function getActiveSapCompany(): Promise<SapCompanyConfig> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(COMPANY_COOKIE_NAME)?.value;

  if (isSapCompanyKey(cookieValue)) {
    return SAP_COMPANIES[cookieValue];
  }

  const value = process.env.APP_COMPANY?.trim().toLowerCase();
  const fallbackKey: SapCompanyKey = value === "novamine" ? "novamine" : "chile";

  return SAP_COMPANIES[fallbackKey];
}

function buildConfig(company: SapCompanyConfig): SqlEnv {
  const port = Number(process.env.SQL_PORT ?? "1433");
  const database = process.env[company.databaseEnvKey];

  if (!process.env.SQL_SERVER || !database) {
    throw new Error(`Faltan variables de entorno para ${company.databaseEnvKey}.`);
  }

  return {
    user: process.env.SQL_USER ?? "",
    password: process.env.SQL_PASSWORD ?? "",
    server: process.env.SQL_SERVER,
    port: Number.isFinite(port) ? port : 1433,
    database,
    options: {
      encrypt: process.env.SQL_ENCRYPT === "true",
      trustServerCertificate: process.env.SQL_TRUST_CERT === "true",
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

export async function getSapPool() {
  const company = await getActiveSapCompany();

  if (!global.__sapStockPools) {
    global.__sapStockPools = {};
  }

  if (!global.__sapStockPools[company.key]) {
    global.__sapStockPools[company.key] = new sql.ConnectionPool(
      buildConfig(company),
    ).connect();
  }

  return global.__sapStockPools[company.key]!;
}

export async function getStockActualRows(): Promise<StockActualRow[]> {
  try {
    const pool = await getSapPool();

    const result = await pool
      .request()
      .query<StockActualRow>(`
        SELECT
          T0.ItemCode AS Codigo,
          T0.ItemName AS Descripcion,
          COALESCE(T0.InvntryUom, '') AS Unidad,
          T2.WhsName AS Bodega,
          CAST(COALESCE(T1.OnHand, 0) AS decimal(18, 2)) AS [Stock Actual],
          CAST(COALESCE(T1.OnOrder, 0) AS decimal(18, 2)) AS Pedido,
          CAST(COALESCE(T1.MinStock, 0) AS decimal(18, 2)) AS [Stock Minimo]
        FROM dbo.OITM T0
        INNER JOIN dbo.OITW T1
          ON T1.ItemCode = T0.ItemCode
        INNER JOIN dbo.OWHS T2
          ON T2.WhsCode = T1.WhsCode
        WHERE T0.validFor = 'Y'
          AND T0.frozenFor = 'N'
          AND T0.InvntItem = 'Y'
        ORDER BY T0.ItemCode, T2.WhsName
      `);

    return result.recordset;
  } catch (error) {
    if (isMissingObjectError(error)) {
      throw new Error(
        `La tabla OITM no existe en la base SAP configurada para ${(await getActiveSapCompany()).label}. Revisa el esquema o la base asignada.`,
      );
    }

    throw error;
  }
}

export async function getOpenPurchaseOrdersByItemCode(
  itemCode: string,
): Promise<OpenPurchaseOrderRow[]> {
  const pool = await getSapPool();

  const result = await pool
    .request()
    .input("itemCode", itemCode)
    .query<OpenPurchaseOrderRow>(`
      SELECT
        T0.DocNum AS NumeroOC,
        CONVERT(varchar(10), T0.DocDate, 120) AS FechaEmision,
        CONVERT(varchar(10), T0.DocDueDate, 120) AS FechaEntrega,
        T2.CardName AS NombreProveedor,
        COALESCE(T3.SlpName, '') AS SlpName,
        CAST(COALESCE(T1.Quantity, 0) AS decimal(18, 2)) AS CantidadTotal,
        CAST(COALESCE(T1.OpenQty, 0) AS decimal(18, 2)) AS CantidadPendiente,
        CAST(COALESCE(T1.Price, 0) AS decimal(18, 2)) AS ValorUnitario,
        CAST(COALESCE(T1.LineTotal, 0) AS decimal(18, 2)) AS ValorTotal
      FROM OPOR T0
      INNER JOIN POR1 T1
        ON T1.DocEntry = T0.DocEntry
      INNER JOIN OCRD T2
        ON T2.CardCode = T0.CardCode
      LEFT JOIN OSLP T3
        ON T3.SlpCode = T0.SlpCode
      WHERE T0.DocStatus = 'O'
        AND T0.CANCELED = 'N'
        AND T1.LineStatus = 'O'
        AND T1.OpenQty > 0
        AND T1.ItemCode = @itemCode
      ORDER BY T0.DocDate DESC, T0.DocNum DESC, T1.LineNum ASC
    `);

  return result.recordset;
}

export async function getProjectBudgetByOtn(
  otn: string,
): Promise<ProjectBudgetRow | null> {
  const pool = await getSapPool();

  const result = await pool
    .request()
    .input("otn", otn)
    .query<ProjectBudgetRow>(`
      SELECT
        CAST(COALESCE(T0.[U_PptoMateriales], 0) AS decimal(18, 2)) AS [MATPPTO],
        CAST(COALESCE(T0.[U_PptoServExt], 0) AS decimal(18, 2)) AS [SERVPPTO],
        COALESCE(T0.[PrjName], '') AS [DESCRIPCION]
      FROM OPRJ T0
      WHERE T0.[PrjCode] = @otn
    `);

  return result.recordset[0] ?? null;
}

export async function getMaterialesUtilizadosByOtn(
  otn: string,
): Promise<MaterialesUtilizadosResult> {
  const pool = await getSapPool();

  const [totalResult, detailResult] = await Promise.all([
    pool.request().input("otn", otn).query<{ MATUTI: number }>(`
      SELECT
        CAST(ISNULL(SUM(T1.[StockPrice] * T1.[Quantity]), 0) AS decimal(18, 2)) AS [MATUTI]
      FROM OIGE T0
      INNER JOIN IGE1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[Project] = @otn
    `),
    pool.request().input("otn", otn).query<MaterialesUtilizadosRow>(`
      SELECT
        T0.DocNum AS Documento,
        CONVERT(varchar(10), T0.DocDate, 120) AS Fecha,
        COALESCE(T1.ItemCode, '') AS Codigo,
        COALESCE(T1.Dscription, '') AS Descripcion,
        CAST(COALESCE(T1.Quantity, 0) AS decimal(18, 2)) AS Cantidad,
        CAST(COALESCE(T1.StockPrice, 0) AS decimal(18, 2)) AS PrecioUnitario,
        CAST(COALESCE(T1.StockPrice * T1.Quantity, 0) AS decimal(18, 2)) AS TotalLinea
      FROM OIGE T0
      INNER JOIN IGE1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[Project] = @otn
      ORDER BY T0.DocDate DESC, T0.DocNum DESC, T1.LineNum ASC
    `),
  ]);

  return {
    total: totalResult.recordset[0]?.MATUTI ?? 0,
    rows: detailResult.recordset,
  };
}

export async function getMaterialesDevueltosByOtn(
  otn: string,
): Promise<MaterialesDevueltosResult> {
  const pool = await getSapPool();

  const [totalResult, detailResult] = await Promise.all([
    pool.request().input("otn", otn).query<{ MATDEV: number }>(`
      SELECT
        CAST(ISNULL(SUM(T1.[StockPrice] * T1.[Quantity]), 0) AS decimal(18, 2)) AS [MATDEV]
      FROM OIGN T0
      INNER JOIN IGN1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[Project] = @otn
    `),
    pool.request().input("otn", otn).query<MaterialesDevueltosRow>(`
      SELECT
        T0.DocNum AS Documento,
        CONVERT(varchar(10), T0.DocDate, 120) AS Fecha,
        COALESCE(T1.ItemCode, '') AS Codigo,
        COALESCE(T1.Dscription, '') AS Descripcion,
        CAST(COALESCE(T1.Quantity, 0) AS decimal(18, 2)) AS Cantidad,
        CAST(COALESCE(T1.StockPrice, 0) AS decimal(18, 2)) AS PrecioUnitario,
        CAST(COALESCE(T1.StockPrice * T1.Quantity, 0) AS decimal(18, 2)) AS TotalLinea
      FROM OIGN T0
      INNER JOIN IGN1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[Project] = @otn
      ORDER BY T0.DocDate DESC, T0.DocNum DESC, T1.LineNum ASC
    `),
  ]);

  return {
    total: totalResult.recordset[0]?.MATDEV ?? 0,
    rows: detailResult.recordset,
  };
}

export async function getServiciosSinOcByOtn(
  otn: string,
): Promise<ServiciosSinOcResult> {
  const pool = await getSapPool();

  const [totalResult, detailResult] = await Promise.all([
    pool.request().input("otn", otn).query<{ SERVUTISINOC: number }>(`
      SELECT
        CAST(ISNULL(SUM(T1.LineTotal), 0) AS decimal(18, 2)) AS [SERVUTISINOC]
      FROM OPCH T0
      INNER JOIN PCH1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[Project] = @otn
        AND T0.DocType = 'S'
        AND T0.Canceled <> 'Y'
        AND T1.BaseDocNum IS NULL
    `),
    pool.request().input("otn", otn).query<ServiciosSinOcRow>(`
      SELECT
        T0.DocNum AS Documento,
        CONVERT(varchar(10), T0.DocDate, 120) AS Fecha,
        COALESCE(T0.CardName, '') AS Proveedor,
        COALESCE(T1.Dscription, '') AS Descripcion,
        CAST(COALESCE(T1.LineTotal, 0) AS decimal(18, 2)) AS TotalLinea
      FROM OPCH T0
      INNER JOIN PCH1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[Project] = @otn
        AND T0.DocType = 'S'
        AND T0.Canceled <> 'Y'
        AND T1.BaseDocNum IS NULL
      ORDER BY T0.DocDate DESC, T0.DocNum DESC, T1.LineNum ASC
    `),
  ]);

  return {
    total: totalResult.recordset[0]?.SERVUTISINOC ?? 0,
    rows: detailResult.recordset,
  };
}

export async function getServiciosUtilizadosByOtn(
  otn: string,
): Promise<ServiciosUtilizadosResult> {
  const pool = await getSapPool();

  const [totalResult, detailResult] = await Promise.all([
    pool.request().input("otn", otn).query<{ SERVUTI: number }>(`
      SELECT
        CAST(ISNULL(SUM(T1.LineTotal), 0) AS decimal(18, 2)) AS [SERVUTI]
      FROM OPOR T0
      INNER JOIN POR1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[Project] = @otn
        AND T0.DocType = 'S'
        AND T0.Canceled <> 'Y'
        AND T0.Indicator <> 'NL'
    `),
    pool.request().input("otn", otn).query<ServiciosUtilizadosRow>(`
      SELECT
        T0.DocNum AS Documento,
        CONVERT(varchar(10), T0.DocDate, 120) AS Fecha,
        COALESCE(T0.CardName, '') AS Proveedor,
        COALESCE(T1.Dscription, '') AS Descripcion,
        CAST(COALESCE(T1.LineTotal, 0) AS decimal(18, 2)) AS TotalLinea
      FROM OPOR T0
      INNER JOIN POR1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[Project] = @otn
        AND T0.DocType = 'S'
        AND T0.Canceled <> 'Y'
        AND T0.Indicator <> 'NL'
      ORDER BY T0.DocDate DESC, T0.DocNum DESC, T1.LineNum ASC
    `),
  ]);

  return {
    total: totalResult.recordset[0]?.SERVUTI ?? 0,
    rows: detailResult.recordset,
  };
}

export async function getNcServiciosByOtn(otn: string): Promise<NcServiciosResult> {
  const pool = await getSapPool();

  const [totalResult, detailResult] = await Promise.all([
    pool.request().input("otn", otn).query<{ SERVNC: number }>(`
      SELECT
        CAST(ISNULL(SUM(T1.LineTotal), 0) AS decimal(18, 2)) AS [SERVNC]
      FROM ORPC T0
      INNER JOIN RPC1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[Project] = @otn
        AND T0.DocType = 'S'
        AND T0.Canceled <> 'Y'
    `),
    pool.request().input("otn", otn).query<NcServiciosRow>(`
      SELECT
        T0.DocNum AS Documento,
        CONVERT(varchar(10), T0.DocDate, 120) AS Fecha,
        COALESCE(T0.CardName, '') AS Proveedor,
        COALESCE(T1.Dscription, '') AS Descripcion,
        CAST(COALESCE(T1.LineTotal, 0) AS decimal(18, 2)) AS TotalLinea
      FROM ORPC T0
      INNER JOIN RPC1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[Project] = @otn
        AND T0.DocType = 'S'
        AND T0.Canceled <> 'Y'
      ORDER BY T0.DocDate DESC, T0.DocNum DESC, T1.LineNum ASC
    `),
  ]);

  return {
    total: totalResult.recordset[0]?.SERVNC ?? 0,
    rows: detailResult.recordset,
  };
}

export async function getAsientosDirectosByOtn(
  otn: string,
): Promise<AsientosDirectosResult> {
  const pool = await getSapPool();

  const [totalResult, detailResult] = await Promise.all([
    pool.request().query<{ SALDO: number }>(`
      SELECT
        CAST(ISNULL(SUM((JDT1.Debit - JDT1.Credit)), 0) AS decimal(18, 2)) AS [SALDO]
      FROM JDT1 JDT1
      INNER JOIN OACT OACT
        ON JDT1.Account = OACT.AcctCode
      INNER JOIN OJDT OJDT
        ON JDT1.TransId = OJDT.TransId
      WHERE OJDT.TransType <> -2
        AND OJDT.TransType <> -3
        AND JDT1.Project = '${otn}'
        AND JDT1.Account >= '50000000'
        AND OJDT.TransType = '30'
    `),
    pool.request().query<AsientosDirectosRow>(`
      SELECT
        OJDT.Number AS Numero,
        CONVERT(varchar(10), OJDT.RefDate, 120) AS Fecha,
        COALESCE(OJDT.BaseRef, '') AS BaseRef,
        COALESCE(JDT1.Account, '') AS Cuenta,
        COALESCE(OACT.AcctName, '') AS NombreCuenta,
        CAST(COALESCE(JDT1.Debit, 0) AS decimal(18, 2)) AS Debe,
        CAST(COALESCE(JDT1.Credit, 0) AS decimal(18, 2)) AS Haber,
        COALESCE(JDT1.Project, '') AS Proyecto,
        COALESCE(JDT1.ProfitCode, '') AS ProfitCode,
        COALESCE(OJDT.Memo, '') AS Memo,
        CAST(COALESCE(JDT1.Line_ID, 0) AS int) AS Linea,
        CAST((COALESCE(JDT1.Debit, 0) - COALESCE(JDT1.Credit, 0)) AS decimal(18, 2)) AS Saldo,
        CAST(COALESCE(OJDT.TransType, 0) AS int) AS TipoTransaccion
      FROM JDT1 JDT1
      INNER JOIN OACT OACT
        ON JDT1.Account = OACT.AcctCode
      INNER JOIN OJDT OJDT
        ON JDT1.TransId = OJDT.TransId
      WHERE OJDT.TransType <> -2
        AND OJDT.TransType <> -3
        AND JDT1.Project = '${otn}'
        AND JDT1.Account >= '50000000'
        AND OJDT.TransType = '30'
      ORDER BY OJDT.RefDate DESC, OJDT.Number DESC, JDT1.Line_ID ASC
    `),
  ]);

  return {
    total: totalResult.recordset[0]?.SALDO ?? 0,
    rows: detailResult.recordset,
  };
}

export async function getFondosRendidosByOtn(
  otn: string,
): Promise<FondosRendidosResult> {
  const pool = await getSapPool();

  const result = await pool.request().query<FondosRendidosRow>(`
    SELECT
      OVPM.DocNum AS NumeroPago,
      CONVERT(varchar(10), OVPM.DocDate, 120) AS FechaPago,
      OVPM.CardName AS EnFavorDe,
      VPM4.AcctName AS Cuenta,
      VPM4.Descrip AS Descripcion,
      CAST(COALESCE(VPM4.SumApplied, 0) AS decimal(18, 2)) AS Monto
    FROM OVPM OVPM, VPM4 VPM4
    WHERE VPM4.DocNum = OVPM.DocNum
      AND (
        (OVPM.TrsfrAcct = '11101001' AND VPM4.Project = '${otn}')
        OR (VPM4.Project = '${otn}' AND OVPM.CashAcct = '11101001')
      )
    UNION ALL
    SELECT
      OVPM.DocNum AS NumeroPago,
      CONVERT(varchar(10), OVPM.DocDate, 120) AS FechaPago,
      OVPM.CardName AS EnFavorDe,
      VPM4.AcctName AS Cuenta,
      VPM4.Descrip AS Descripcion,
      CAST(COALESCE(VPM4.SumApplied, 0) AS decimal(18, 2)) AS Monto
    FROM OVPM OVPM, VPM1 VPM1, VPM4 VPM4
    WHERE VPM4.DocNum = OVPM.DocNum
      AND VPM1.DocNum = VPM4.DocNum
      AND VPM4.LineId = VPM1.LineID
      AND VPM1.CheckAct = '11101001'
      AND VPM4.Project = '${otn}'
    ORDER BY FechaPago DESC, NumeroPago DESC
  `);

  return {
    total: result.recordset.reduce((sum, row) => sum + (row.Monto ?? 0), 0),
    rows: result.recordset,
  };
}
