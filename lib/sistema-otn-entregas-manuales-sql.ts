import { ensureDatabaseSchema } from "@/lib/db-schema";
import { getAuthPool } from "@/lib/auth-sql";

export type SistemaOtnEntregaManualRow = {
  Id: number;
  OTN: string;
  FechaEntrega: string;
  ValorEntrega: number;
  ReferenciaEntrega: string | null;
  CreadoEn: string;
  ActualizadoEn: string;
};

export type SistemaOtnEntregaManualInput = {
  OTN: string;
  FechaEntrega: string;
  ValorEntrega: number;
  ReferenciaEntrega?: string | null;
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

export async function listSistemaOtnEntregasManualesRowsByOtn(
  otn: string,
): Promise<SistemaOtnEntregaManualRow[]> {
  const normalizedOtn = otn.trim();
  if (!normalizedOtn) {
    return [];
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input("otn", normalizedOtn)
    .query<SistemaOtnEntregaManualRow>(`
      SELECT
        Id,
        OTN,
        CONVERT(varchar(10), FechaEntrega, 23) AS FechaEntrega,
        ValorEntrega,
        ReferenciaEntrega,
        CONVERT(varchar(19), CreadoEn, 120) AS CreadoEn,
        CONVERT(varchar(19), ActualizadoEn, 120) AS ActualizadoEn
      FROM dbo.SistemaOtnEntregasManuales
      WHERE OTN = @otn
      ORDER BY FechaEntrega DESC, Id DESC
    `);

  return result.recordset;
}

export async function createSistemaOtnEntregaManualRow(input: SistemaOtnEntregaManualInput) {
  const pool = await getPool();

  await pool
    .request()
    .input("otn", input.OTN.trim())
    .input("fechaEntrega", normalizeDate(input.FechaEntrega))
    .input("valorEntrega", normalizeNumber(input.ValorEntrega))
    .input("referenciaEntrega", normalizeText(input.ReferenciaEntrega))
    .query(`
      INSERT INTO dbo.SistemaOtnEntregasManuales
        (
          OTN,
          FechaEntrega,
          ValorEntrega,
          ReferenciaEntrega
        )
      VALUES
        (
          @otn,
          @fechaEntrega,
          @valorEntrega,
          @referenciaEntrega
        )
    `);
}

export async function deleteSistemaOtnEntregaManualRow(id: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .query(`
      DELETE FROM dbo.SistemaOtnEntregasManuales
      WHERE Id = ${id}
    `);

  return result.rowsAffected[0] ?? 0;
}
