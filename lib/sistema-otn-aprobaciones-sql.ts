import { ensureDatabaseSchema } from "@/lib/db-schema";
import { revalidateTag, unstable_cache } from "next/cache";
import { getAuthPool } from "@/lib/auth-sql";
import {
  DEFAULT_CACHE_REVALIDATE_SECONDS,
  PLATFORM_CACHE_TAGS,
} from "@/lib/platform-cache";
import { measureAsync } from "@/lib/server-performance";

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

const listSistemaOtnAprobacionesCached = unstable_cache(
  async () => {
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
  },
  ["platform", "sistema-otn", "aprobaciones", "list"],
  {
    tags: [PLATFORM_CACHE_TAGS.sistemaOtn],
    revalidate: DEFAULT_CACHE_REVALIDATE_SECONDS,
  },
);

const getSistemaOtnAprobacionesRowsByOtnCached = unstable_cache(
  async (otn: string) => {
    const normalizedOtn = otn.trim();
    if (!normalizedOtn) {
      return [];
    }

    return measureAsync(
      "sistema-otn.aprobaciones.by-otn",
      async () => {
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
      },
      {
        slowMs: 100,
        details: `otn=${normalizedOtn}`,
      },
    );
  },
  ["platform", "sistema-otn", "aprobaciones", "otn"],
  {
    tags: [PLATFORM_CACHE_TAGS.sistemaOtn],
    revalidate: DEFAULT_CACHE_REVALIDATE_SECONDS,
  },
);

export async function listSistemaOtnAprobacionesRows(): Promise<SistemaOtnAprobacionRow[]> {
  return listSistemaOtnAprobacionesCached();
}

export async function getSistemaOtnAprobacionesRowsByOtn(
  otn: string,
): Promise<SistemaOtnAprobacionRow[]> {
  return getSistemaOtnAprobacionesRowsByOtnCached(otn);
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

  revalidateTag(PLATFORM_CACHE_TAGS.sistemaOtn, "max");
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

  if (result.rowsAffected[0] ?? 0) {
    revalidateTag(PLATFORM_CACHE_TAGS.sistemaOtn, "max");
  }

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

  if (result.rowsAffected[0] ?? 0) {
    revalidateTag(PLATFORM_CACHE_TAGS.sistemaOtn, "max");
  }

  return result.rowsAffected[0] ?? 0;
}
