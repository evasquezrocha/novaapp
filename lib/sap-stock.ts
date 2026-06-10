import sql from "mssql";
import { cache } from "react";
import { cookies } from "next/headers";
import {
  COMPANY_COOKIE_NAME,
  SAP_COMPANIES,
  isSapCompanyKey,
  resolveSapCompanyKeyFromEmpresa,
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

export type EquivalentStockRow = StockActualRow & {
  EsPrincipal: boolean;
};

export type PurchaseOrderSearchRow = {
  "N° OC": number;
  OTN: string;
  CC: string;
  PROVEEDOR: string;
  "N° O/C": number;
  "FECHA O/C": string;
  "N° ITEM": string;
  "DESCRIPCIÓN": string;
  CANT: number;
  "CANT ABIERTA": number;
  PRECIO: number;
  TOTAL: number;
  "SOLICITADO POR": string;
  "CREADO POR": string;
};

export type PurchaseOrderSearchMode = "proveedor" | "descripcion" | "codigo";

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

export type SalesInvoiceLineRow = {
  LineNum: number;
  DescripcionLinea: string;
  Cantidad: number;
  PrecioUnitario: number;
  ValorTotal: number;
};

export type SalesInvoiceRow = {
  DocEntry: number;
  NumeroFV: number;
  FolioNum: number | null;
  Fecha: string;
  FechaVencimiento: string;
  Total: number;
  TotalPendiente: number;
  lineas: SalesInvoiceLineRow[];
};

export type SalesInvoiceResult = {
  rows: SalesInvoiceRow[];
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

export type MaterialesUtilizadosCcResult = {
  total: number;
  rows: MaterialesUtilizadosRow[];
};

export type MaterialesDevueltosCcResult = {
  total: number;
  rows: MaterialesDevueltosRow[];
};

export type ServiciosSinOcCcResult = {
  total: number;
  rows: ServiciosSinOcRow[];
};

export type ServiciosUtilizadosCcResult = {
  total: number;
  rows: ServiciosUtilizadosRow[];
};

export type NcServiciosCcResult = {
  total: number;
  rows: NcServiciosRow[];
};

export type CentroCostoCcResult = {
  codigo: string;
  descripcion: string;
  presupuestoMensualMateriales: number;
  presupuestoMensualServicios: number;
};

function getProjectCodeForCompany(company: SapCompanyConfig) {
  return company.key === "chile" ? "130531" : "171603";
}

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

export type SalesCreditNoteLineRow = {
  LineNum: number;
  DescripcionLinea: string;
  Cantidad: number;
  PrecioUnitario: number;
  ValorTotal: number;
};

export type SalesCreditNoteRow = {
  DocEntry: number;
  NumeroNC: number;
  Fecha: string;
  TotalNeto: number;
  FacturaRef: string;
  lineas: SalesCreditNoteLineRow[];
};

export type SalesCreditNoteResult = {
  total: number;
  rows: SalesCreditNoteRow[];
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

function getCurrentMonthRange(timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new Error("No fue posible calcular el mes actual.");
  }

  const firstDay = `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-01`;
  const nextMonthStart = new Date(Date.UTC(year, month, 1));
  const lastDayDate = new Date(nextMonthStart.getTime() - 1);
  const lastDay = `${lastDayDate.getUTCFullYear().toString().padStart(4, "0")}-${(
    lastDayDate.getUTCMonth() + 1
  )
    .toString()
    .padStart(2, "0")}-${lastDayDate.getUTCDate().toString().padStart(2, "0")}`;

  return {
    firstDay,
    lastDay,
  };
}

export const getActiveSapCompany = cache(async (): Promise<SapCompanyConfig> => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(COMPANY_COOKIE_NAME)?.value;

  if (isSapCompanyKey(cookieValue)) {
    return SAP_COMPANIES[cookieValue];
  }

  const value = process.env.APP_COMPANY?.trim().toLowerCase();
  const fallbackKey: SapCompanyKey = value === "novamine" ? "novamine" : "chile";

  return SAP_COMPANIES[fallbackKey];
});

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

  return getSapPoolForCompany(company.key);
}

export async function getSapPoolForCompany(companyKey: SapCompanyKey) {
  const company = SAP_COMPANIES[companyKey];

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

export async function getSapPoolForOtnEmpresa(empresa: string | null | undefined) {
  return getSapPoolForCompany(resolveSapCompanyKeyFromEmpresa(empresa));
}

export function getSapCompanyKeyForOtnEmpresa(empresa: string | null | undefined) {
  return resolveSapCompanyKeyFromEmpresa(empresa);
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

export async function getEquivalentStockRowsByCode(
  codigo: string,
): Promise<EquivalentStockRow[]> {
  const searchCode = codigo.trim();

  if (!searchCode) {
    return [];
  }

  const pool = await getSapPool();

  try {
    const result = await pool
      .request()
      .input("codigo", searchCode)
      .query<EquivalentStockRow>(`
        SELECT
          T0.ItemCode AS Codigo,
          T0.ItemName AS Descripcion,
          COALESCE(T0.InvntryUom, '') AS Unidad,
          T2.WhsName AS Bodega,
          CAST(COALESCE(T1.OnHand, 0) AS decimal(18, 2)) AS [Stock Actual],
          CAST(COALESCE(T1.OnOrder, 0) AS decimal(18, 2)) AS Pedido,
          CAST(COALESCE(T1.MinStock, 0) AS decimal(18, 2)) AS [Stock Minimo],
          CASE WHEN T0.ItemCode = @codigo THEN 1 ELSE 0 END AS EsPrincipal
        FROM dbo.OITM T0
        INNER JOIN dbo.OITW T1
          ON T1.ItemCode = T0.ItemCode
        INNER JOIN dbo.OWHS T2
          ON T2.WhsCode = T1.WhsCode
        WHERE T0.validFor = 'Y'
          AND T0.frozenFor = 'N'
          AND T0.InvntItem = 'Y'
          AND (
            T0.ItemCode = @codigo
            OR EXISTS (
              SELECT 1
              FROM dbo.OMLT O
              INNER JOIN dbo.MLT1 M
                ON M.TranEntry = O.TranEntry
              WHERE CONVERT(nvarchar(max), O.PK) = @codigo
                AND CONVERT(nvarchar(max), M.Trans) = CONVERT(nvarchar(max), T0.ItemCode)
            )
          )
        ORDER BY
          CASE WHEN T0.ItemCode = @codigo THEN 0 ELSE 1 END,
          T0.ItemCode,
          T2.WhsName
      `);

    return result.recordset;
  } catch (error) {
    if (isMissingObjectError(error)) {
      throw new Error(
        `No fue posible consultar las equivalencias porque falta una tabla SAP en ${(
          await getActiveSapCompany()
        ).label}. Revisa OITM, OITW, OWHS, OMLT o MLT1.`,
      );
    }

    throw error;
  }
}

export async function getPurchaseOrderSearchRows(): Promise<PurchaseOrderSearchRow[]> {
  const pool = await getSapPool();

  const result = await pool.request().query<PurchaseOrderSearchRow>(`
    SELECT
      CAST(OPOR.DocNum AS int) AS [N° OC],
      COALESCE(POR1.Project, '') AS [OTN],
      COALESCE(POR1.OcrCode, '') AS [CC],
      COALESCE(OPOR.CardName, '') AS [PROVEEDOR],
      CAST(OPOR.DocNum AS int) AS [N° O/C],
      CONVERT(varchar(10), OPOR.DocDate, 120) AS [FECHA O/C],
      COALESCE(POR1.ItemCode, '') AS [N° ITEM],
      COALESCE(POR1.Dscription, '') AS [DESCRIPCIÓN],
      CAST(COALESCE(POR1.Quantity, 0) AS decimal(18, 2)) AS [CANT],
      CAST(COALESCE(POR1.OpenCreQty, 0) AS decimal(18, 2)) AS [CANT ABIERTA],
      CAST(COALESCE(POR1.Price, 0) AS decimal(18, 2)) AS [PRECIO],
      CAST(COALESCE(POR1.LineTotal, 0) AS decimal(18, 2)) AS [TOTAL],
      COALESCE(OSLP.SlpName, '') AS [SOLICITADO POR],
      COALESCE(OUSR.U_NAME, '') AS [CREADO POR]
    FROM OPOR OPOR
    INNER JOIN POR1 POR1
      ON POR1.DocEntry = OPOR.DocEntry
    INNER JOIN OUSR OUSR
      ON OPOR.UserSign = OUSR.USERID
    INNER JOIN OSLP OSLP
      ON OSLP.SlpCode = OPOR.SlpCode
    WHERE OPOR.Canceled <> 'Y'
    ORDER BY OPOR.DocDate DESC, OPOR.DocNum DESC, POR1.LineNum ASC
  `);

  return result.recordset;
}

function escapeSqlString(value: string) {
  return value.replace(/'/g, "''");
}

export async function searchPurchaseOrderRows(input: {
  mode: PurchaseOrderSearchMode;
  query: string;
}): Promise<PurchaseOrderSearchRow[]> {
  const search = input.query.trim();

  if (!search) {
    return [];
  }

  const pool = await getSapPool();
  const escaped = escapeSqlString(search);

  const whereClause =
    input.mode === "proveedor"
      ? `OPOR.CardName LIKE '%${escaped}%'`
      : input.mode === "descripcion"
        ? `POR1.Dscription LIKE '%${escaped}%'`
        : `POR1.ItemCode LIKE '%${escaped}%'`;

  const result = await pool.request().query<PurchaseOrderSearchRow>(`
    SELECT
      CAST(OPOR.DocNum AS int) AS [N° OC],
      COALESCE(POR1.Project, '') AS [OTN],
      COALESCE(POR1.OcrCode, '') AS [CC],
      COALESCE(OPOR.CardName, '') AS [PROVEEDOR],
      CAST(OPOR.DocNum AS int) AS [N° O/C],
      CONVERT(varchar(10), OPOR.DocDate, 120) AS [FECHA O/C],
      COALESCE(POR1.ItemCode, '') AS [N° ITEM],
      COALESCE(POR1.Dscription, '') AS [DESCRIPCIÓN],
      CAST(COALESCE(POR1.Quantity, 0) AS decimal(18, 2)) AS [CANT],
      CAST(COALESCE(POR1.OpenCreQty, 0) AS decimal(18, 2)) AS [CANT ABIERTA],
      CAST(COALESCE(POR1.Price, 0) AS decimal(18, 2)) AS [PRECIO],
      CAST(COALESCE(POR1.LineTotal, 0) AS decimal(18, 2)) AS [TOTAL],
      COALESCE(OSLP.SlpName, '') AS [SOLICITADO POR],
      COALESCE(OUSR.U_NAME, '') AS [CREADO POR]
    FROM OPOR OPOR
    INNER JOIN POR1 POR1
      ON POR1.DocEntry = OPOR.DocEntry
    INNER JOIN OUSR OUSR
      ON OPOR.UserSign = OUSR.USERID
    INNER JOIN OSLP OSLP
      ON OSLP.SlpCode = OPOR.SlpCode
    WHERE OPOR.Canceled <> 'Y'
      AND ${whereClause}
    ORDER BY OPOR.DocDate DESC, OPOR.DocNum DESC, POR1.LineNum ASC
  `);

  return result.recordset;
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
  companyKey?: SapCompanyKey | null,
): Promise<MaterialesUtilizadosResult> {
  const pool = companyKey ? await getSapPoolForCompany(companyKey) : await getSapPool();

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

export async function getSalesInvoicesByOtn(
  otn: string,
  companyKey?: SapCompanyKey | null,
): Promise<SalesInvoiceResult> {
  const pool = companyKey ? await getSapPoolForCompany(companyKey) : await getSapPool();

  const result = await pool.request().input("otn", otn).query<
    SalesInvoiceRow & SalesInvoiceLineRow
  >(`
    SELECT
      T0.DocEntry AS DocEntry,
      T0.DocNum AS NumeroFV,
      T0.FolioNum AS FolioNum,
      CONVERT(varchar(10), T0.DocDate, 120) AS Fecha,
      CONVERT(varchar(10), T0.DocDueDate, 120) AS FechaVencimiento,
      CAST(COALESCE(T0.DocTotal, 0) - COALESCE(T0.VatSum, 0) AS decimal(18, 2)) AS Total,
      CAST(
        CASE
          WHEN COALESCE(T0.DocTotal, 0) = 0 THEN 0
          ELSE (COALESCE(T0.DocTotal, 0) - COALESCE(T0.VatSum, 0))
            * (
              CASE
                WHEN COALESCE(T0.DocTotal, 0) - COALESCE(T0.PaidToDate, 0) < 0 THEN 0
                ELSE COALESCE(T0.DocTotal, 0) - COALESCE(T0.PaidToDate, 0)
              END
            )
            / NULLIF(COALESCE(T0.DocTotal, 0), 0)
        END
        AS decimal(18, 2)
      ) AS TotalPendiente,
      T1.LineNum AS LineNum,
      COALESCE(T1.Dscription, '') AS DescripcionLinea,
      CAST(COALESCE(T1.Quantity, 0) AS decimal(18, 2)) AS Cantidad,
      CAST(COALESCE(T1.Price, 0) AS decimal(18, 2)) AS PrecioUnitario,
      CAST(COALESCE(T1.LineTotal, 0) AS decimal(18, 2)) AS ValorTotal
    FROM OINV T0
    INNER JOIN INV1 T1
      ON T0.DocEntry = T1.DocEntry
    WHERE T0.CANCELED = 'N'
      AND T1.[Project] = @otn
    ORDER BY T0.DocDate DESC, T0.DocNum DESC, T1.LineNum ASC
  `);

  const grouped = new Map<number, SalesInvoiceRow>();

  for (const row of result.recordset) {
    const existing = grouped.get(row.DocEntry);
    const line: SalesInvoiceLineRow = {
      LineNum: row.LineNum,
      DescripcionLinea: row.DescripcionLinea,
      Cantidad: row.Cantidad,
      PrecioUnitario: row.PrecioUnitario,
      ValorTotal: row.ValorTotal,
    };

    if (!existing) {
      grouped.set(row.DocEntry, {
        DocEntry: row.DocEntry,
        NumeroFV: row.NumeroFV,
        FolioNum: row.FolioNum,
        Fecha: row.Fecha,
        FechaVencimiento: row.FechaVencimiento,
        Total: row.Total,
        TotalPendiente: row.TotalPendiente,
        lineas: [line],
      });
      continue;
    }

    existing.lineas.push(line);
  }

  return {
    rows: Array.from(grouped.values()),
  };
}

export async function getMaterialesUtilizadosByCc(
  cc: string,
): Promise<MaterialesUtilizadosCcResult> {
  const pool = await getSapPool();
  const project = getProjectCodeForCompany(await getActiveSapCompany());
  const { firstDay, lastDay } = getCurrentMonthRange("America/Santiago");

  const [totalResult, detailResult] = await Promise.all([
    pool.request().input("cc", cc).input("project", project).query<{ MATUTI: number }>(`
      SELECT
        CAST(ISNULL(SUM(T1.[StockPrice] * T1.[Quantity]), 0) AS decimal(18, 2)) AS [MATUTI]
      FROM OIGE T0
      INNER JOIN IGE1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[OcrCode] = @cc
        AND T1.[Project] = @project
        AND CONVERT(date, T0.DocDate) >= CONVERT(date, '${firstDay}')
        AND CONVERT(date, T0.DocDate) <= CONVERT(date, '${lastDay}')
    `),
    pool.request().input("cc", cc).input("project", project).query<MaterialesUtilizadosRow>(`
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
      WHERE T1.[OcrCode] = @cc
        AND T1.[Project] = @project
        AND CONVERT(date, T0.DocDate) >= CONVERT(date, '${firstDay}')
        AND CONVERT(date, T0.DocDate) <= CONVERT(date, '${lastDay}')
      ORDER BY T0.DocDate DESC, T0.DocNum DESC, T1.LineNum ASC
    `),
  ]);

  return {
    total: totalResult.recordset[0]?.MATUTI ?? 0,
    rows: detailResult.recordset,
  };
}

export async function getMaterialesDevueltosByCc(
  cc: string,
): Promise<MaterialesDevueltosCcResult> {
  const pool = await getSapPool();
  const project = getProjectCodeForCompany(await getActiveSapCompany());
  const { firstDay, lastDay } = getCurrentMonthRange("America/Santiago");

  const [totalResult, detailResult] = await Promise.all([
    pool.request().input("cc", cc).input("project", project).query<{ MATDEV: number }>(`
      SELECT
        CAST(ISNULL(SUM(T1.[StockPrice] * T1.[Quantity]), 0) AS decimal(18, 2)) AS [MATDEV]
      FROM OIGN T0
      INNER JOIN IGN1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[OcrCode] = @cc
        AND T1.[Project] = @project
        AND CONVERT(date, T0.DocDate) >= CONVERT(date, '${firstDay}')
        AND CONVERT(date, T0.DocDate) <= CONVERT(date, '${lastDay}')
    `),
    pool.request().input("cc", cc).input("project", project).query<MaterialesDevueltosRow>(`
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
      WHERE T1.[OcrCode] = @cc
        AND T1.[Project] = @project
        AND CONVERT(date, T0.DocDate) >= CONVERT(date, '${firstDay}')
        AND CONVERT(date, T0.DocDate) <= CONVERT(date, '${lastDay}')
      ORDER BY T0.DocDate DESC, T0.DocNum DESC, T1.LineNum ASC
    `),
  ]);

  return {
    total: totalResult.recordset[0]?.MATDEV ?? 0,
    rows: detailResult.recordset,
  };
}

export async function getServiciosSinOcByCc(
  cc: string,
): Promise<ServiciosSinOcCcResult> {
  const pool = await getSapPool();
  const project = getProjectCodeForCompany(await getActiveSapCompany());
  const { firstDay, lastDay } = getCurrentMonthRange("America/Santiago");

  const [totalResult, detailResult] = await Promise.all([
    pool.request().input("cc", cc).input("project", project).query<{ SERVUTISINOC: number }>(`
      SELECT ISNULL(SUM(T1.LineTotal),0) AS [SERVUTISINOC]
      FROM OPCH T0
      INNER JOIN PCH1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[OcrCode] = @cc
        AND T1.[Project] = @project
        AND T0.DocType = 'S'
        AND T0.Canceled <> 'Y'
        AND T1.BaseDocNum IS NULL
        AND CONVERT(date, T0.DocDate) >= CONVERT(date, '${firstDay}')
        AND CONVERT(date, T0.DocDate) <= CONVERT(date, '${lastDay}')
    `),
    pool.request().input("cc", cc).input("project", project).query<ServiciosSinOcRow>(`
      SELECT
        T0.DocNum AS Documento,
        CONVERT(varchar(10), T0.DocDate, 120) AS Fecha,
        COALESCE(T0.CardName, '') AS Proveedor,
        COALESCE(T1.Dscription, '') AS Descripcion,
        CAST(COALESCE(T1.LineTotal, 0) AS decimal(18, 2)) AS TotalLinea
      FROM OPCH T0
      INNER JOIN PCH1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[OcrCode] = @cc
        AND T1.[Project] = @project
        AND T0.DocType = 'S'
        AND T0.Canceled <> 'Y'
        AND T1.BaseDocNum IS NULL
        AND CONVERT(date, T0.DocDate) >= CONVERT(date, '${firstDay}')
        AND CONVERT(date, T0.DocDate) <= CONVERT(date, '${lastDay}')
      ORDER BY T0.DocDate DESC, T0.DocNum DESC, T1.LineNum ASC
    `),
  ]);

  return {
    total: totalResult.recordset[0]?.SERVUTISINOC ?? 0,
    rows: detailResult.recordset,
  };
}

export async function getServiciosUtilizadosByCc(
  cc: string,
): Promise<ServiciosUtilizadosCcResult> {
  const pool = await getSapPool();
  const project = getProjectCodeForCompany(await getActiveSapCompany());
  const { firstDay, lastDay } = getCurrentMonthRange("America/Santiago");

  const [totalResult, detailResult] = await Promise.all([
    pool.request().input("cc", cc).input("project", project).query<{ SERVUTI: number }>(`
      SELECT
        CAST(ISNULL(SUM(T1.LineTotal), 0) AS decimal(18, 2)) AS [SERVUTI]
      FROM OPOR T0
      INNER JOIN POR1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[OcrCode] = @cc
        AND T1.[Project] = @project
        AND T0.DocType = 'S'
        AND T0.Canceled <> 'Y'
        AND T0.Indicator <> 'NL'
        AND CONVERT(date, T0.DocDate) >= CONVERT(date, '${firstDay}')
        AND CONVERT(date, T0.DocDate) <= CONVERT(date, '${lastDay}')
    `),
    pool.request().input("cc", cc).input("project", project).query<ServiciosUtilizadosRow>(`
      SELECT
        T0.DocNum AS Documento,
        CONVERT(varchar(10), T0.DocDate, 120) AS Fecha,
        COALESCE(T0.CardName, '') AS Proveedor,
        COALESCE(T1.Dscription, '') AS Descripcion,
        CAST(COALESCE(T1.LineTotal, 0) AS decimal(18, 2)) AS TotalLinea
      FROM OPOR T0
      INNER JOIN POR1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[OcrCode] = @cc
        AND T1.[Project] = @project
        AND T0.DocType = 'S'
        AND T0.Canceled <> 'Y'
        AND T0.Indicator <> 'NL'
        AND CONVERT(date, T0.DocDate) >= CONVERT(date, '${firstDay}')
        AND CONVERT(date, T0.DocDate) <= CONVERT(date, '${lastDay}')
      ORDER BY T0.DocDate DESC, T0.DocNum DESC, T1.LineNum ASC
    `),
  ]);

  return {
    total: totalResult.recordset[0]?.SERVUTI ?? 0,
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

export async function getCentroCostoByCc(cc: string): Promise<CentroCostoCcResult> {
  const pool = await getSapPool();

  const result = await pool
    .request()
    .input("cc", cc)
    .query<{
      Descripcion: string;
      PresupuestoMensualMateriales: number;
      PresupuestoMensualServicios: number;
    }>(`
    SELECT
      COALESCE(T0.PrcName, '') AS Descripcion,
      CAST(COALESCE(T0.[U_PptoMat], 0) AS decimal(18, 2)) AS PresupuestoMensualMateriales,
      CAST(COALESCE(T0.[U_PptoServExt], 0) AS decimal(18, 2)) AS PresupuestoMensualServicios
    FROM OPRC T0
    WHERE T0.PrcCode = @cc
  `);

  return {
    codigo: cc,
    descripcion: result.recordset[0]?.Descripcion ?? "",
    presupuestoMensualMateriales: result.recordset[0]?.PresupuestoMensualMateriales ?? 0,
    presupuestoMensualServicios: result.recordset[0]?.PresupuestoMensualServicios ?? 0,
  };
}

export async function getNcServiciosByCc(
  cc: string,
): Promise<NcServiciosCcResult> {
  const pool = await getSapPool();
  const project = getProjectCodeForCompany(await getActiveSapCompany());
  const { firstDay, lastDay } = getCurrentMonthRange("America/Santiago");

  const [totalResult, detailResult] = await Promise.all([
    pool.request().input("cc", cc).input("project", project).query<{ SERVNC: number }>(`
      SELECT
        CAST(ISNULL(SUM(T1.LineTotal), 0) AS decimal(18, 2)) AS [SERVNC]
      FROM ORPC T0
      INNER JOIN RPC1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[OcrCode] = @cc
        AND T1.[Project] = @project
        AND T0.DocType = 'S'
        AND T0.Canceled <> 'Y'
        AND CONVERT(date, T0.DocDate) >= CONVERT(date, '${firstDay}')
        AND CONVERT(date, T0.DocDate) <= CONVERT(date, '${lastDay}')
    `),
    pool.request().input("cc", cc).input("project", project).query<NcServiciosRow>(`
      SELECT
        T0.DocNum AS Documento,
        CONVERT(varchar(10), T0.DocDate, 120) AS Fecha,
        COALESCE(T0.CardName, '') AS Proveedor,
        COALESCE(T1.Dscription, '') AS Descripcion,
        CAST(COALESCE(T1.LineTotal, 0) AS decimal(18, 2)) AS TotalLinea
      FROM ORPC T0
      INNER JOIN RPC1 T1
        ON T0.DocEntry = T1.DocEntry
      WHERE T1.[OcrCode] = @cc
        AND T1.[Project] = @project
        AND T0.DocType = 'S'
        AND T0.Canceled <> 'Y'
        AND CONVERT(date, T0.DocDate) >= CONVERT(date, '${firstDay}')
        AND CONVERT(date, T0.DocDate) <= CONVERT(date, '${lastDay}')
      ORDER BY T0.DocDate DESC, T0.DocNum DESC, T1.LineNum ASC
    `),
  ]);

  return {
    total: totalResult.recordset[0]?.SERVNC ?? 0,
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

export async function getSalesCreditNotesByOtn(
  otn: string,
  companyKey?: SapCompanyKey | null,
): Promise<SalesCreditNoteResult> {
  const pool = companyKey ? await getSapPoolForCompany(companyKey) : await getSapPool();

  const result = await pool.request().input("otn", otn).query<SalesCreditNoteRow & SalesCreditNoteLineRow>(`
    SELECT
      T0.DocEntry AS DocEntry,
      T0.DocNum AS NumeroNC,
      CONVERT(varchar(10), T0.DocDate, 120) AS Fecha,
      CAST(COALESCE(T0.DocTotal, 0) - COALESCE(T0.VatSum, 0) AS decimal(18, 2)) AS TotalNeto,
      COALESCE(CONVERT(varchar(50), T0.U_Folio_Ref), '') AS FacturaRef,
      T1.LineNum AS LineNum,
      COALESCE(T1.Dscription, '') AS DescripcionLinea,
      CAST(COALESCE(T1.Quantity, 0) AS decimal(18, 2)) AS Cantidad,
      CAST(COALESCE(T1.Price, 0) AS decimal(18, 2)) AS PrecioUnitario,
      CAST(COALESCE(T1.LineTotal, 0) AS decimal(18, 2)) AS ValorTotal
    FROM ORIN T0
    INNER JOIN RIN1 T1
      ON T0.DocEntry = T1.DocEntry
    WHERE T0.CANCELED = 'N'
      AND T1.[Project] = @otn
    ORDER BY T0.DocDate DESC, T0.DocNum DESC, T1.LineNum ASC
  `);

  const grouped = new Map<number, SalesCreditNoteRow>();

  for (const row of result.recordset) {
    const existing = grouped.get(row.DocEntry);
    const line: SalesCreditNoteLineRow = {
      LineNum: row.LineNum,
      DescripcionLinea: row.DescripcionLinea,
      Cantidad: row.Cantidad,
      PrecioUnitario: row.PrecioUnitario,
      ValorTotal: row.ValorTotal,
    };

    if (!existing) {
      grouped.set(row.DocEntry, {
        DocEntry: row.DocEntry,
        NumeroNC: row.NumeroNC,
        Fecha: row.Fecha,
        TotalNeto: row.TotalNeto,
        FacturaRef: row.FacturaRef,
        lineas: [line],
      });
      continue;
    }

    existing.lineas.push(line);
  }

  const rows = Array.from(grouped.values());
  return {
    total: rows.reduce((sum, row) => sum + row.TotalNeto, 0),
    rows,
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
