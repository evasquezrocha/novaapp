import { ensureDatabaseSchema } from "@/lib/db-schema";
import { getAuthPool } from "@/lib/auth-sql";

export type SistemaOtnAprobacionRow = {
  Id: number;
  OTN: string;
  FechaAprobacion: string;
  ValorAprobado: number;
  OC: string | null;
  ReferenciaCliente: string | null;
  CreadoEn: string;
  ActualizadoEn: string;
};

export type SistemaOtnAprobacionInput = {
  OTN: string;
  FechaAprobacion: string;
  ValorAprobado: number;
  OC?: string | null;
  ReferenciaCliente?: string | null;
};

export type SistemaOtnAprobacionUpdateInput = {
  FechaAprobacion: string;
  ValorAprobado: number;
  OC?: string | null;
  ReferenciaCliente?: string | null;
};

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeDate(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function getPool() {
  await ensureDatabaseSchema();
  return getAuthPool();
}

export async function listSistemaOtnAprobacionesRows(): Promise<SistemaOtnAprobacionRow[]> {
  const pool = await getPool();
  const result = await pool.request().query<SistemaOtnAprobacionRow>(`
    SELECT
      Id,
      OTN,
      CONVERT(varchar(10), FechaAprobacion, 23) AS FechaAprobacion,
      ValorAprobado,
      OC,
      ReferenciaCliente,
      CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
      CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
    FROM dbo.SistemaOtnAprobaciones
    ORDER BY Id DESC
  `);

  return result.recordset;
}

export async function getSistemaOtnAprobacionesRowsByOtn(
  otn: string,
): Promise<SistemaOtnAprobacionRow[]> {
  const normalizedOtn = otn.trim();
  if (!normalizedOtn) {
    return [];
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input("otn", normalizedOtn)
    .query<SistemaOtnAprobacionRow>(`
      SELECT
        Id,
        OTN,
        CONVERT(varchar(10), FechaAprobacion, 23) AS FechaAprobacion,
        ValorAprobado,
        OC,
        ReferenciaCliente,
        CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
        CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
      FROM dbo.SistemaOtnAprobaciones
      WHERE OTN = @otn
      ORDER BY Id DESC
    `);

  return result.recordset;
}

export async function createSistemaOtnAprobacionRow(input: SistemaOtnAprobacionInput) {
  const pool = await getPool();

  await pool
    .request()
    .input("otn", input.OTN.trim())
    .input("fechaAprobacion", normalizeDate(input.FechaAprobacion))
    .input("valorAprobado", normalizeNumber(input.ValorAprobado))
    .input("oc", normalizeText(input.OC))
    .input("referenciaCliente", normalizeText(input.ReferenciaCliente))
    .query(`
      INSERT INTO dbo.SistemaOtnAprobaciones
        (
          OTN,
          FechaAprobacion,
          ValorAprobado,
          OC,
          ReferenciaCliente
        )
      VALUES
        (
          @otn,
          @fechaAprobacion,
          @valorAprobado,
          @oc,
          @referenciaCliente
        )
    `);
}

export async function updateSistemaOtnAprobacionRow(
  id: number,
  input: SistemaOtnAprobacionUpdateInput,
) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("fechaAprobacion", normalizeDate(input.FechaAprobacion))
    .input("valorAprobado", normalizeNumber(input.ValorAprobado))
    .input("oc", normalizeText(input.OC))
    .input("referenciaCliente", normalizeText(input.ReferenciaCliente))
    .query(`
      UPDATE dbo.SistemaOtnAprobaciones
      SET
        FechaAprobacion = @fechaAprobacion,
        ValorAprobado = @valorAprobado,
        OC = @oc,
        ReferenciaCliente = @referenciaCliente,
        ActualizadoEn = SYSUTCDATETIME()
      WHERE Id = ${id}
    `);

  return result.rowsAffected[0] ?? 0;
}

export async function deleteSistemaOtnAprobacionRow(id: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .query(`
      DELETE FROM dbo.SistemaOtnAprobaciones
      WHERE Id = ${id}
    `);

  return result.rowsAffected[0] ?? 0;
}
