import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sql from "mssql";

function loadEnv(filePath) {
  const envText = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toStringValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function toNumberValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBooleanValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = normalizeText(value);
  if (["si", "s", "true", "1", "x", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["no", "false", "0", "n"].includes(normalized)) {
    return false;
  }

  return null;
}

function excelToDate(value, yearValue) {
  const text = toStringValue(value);
  if (text) {
    return text;
  }

  const year = toNumberValue(yearValue);
  if (year && Number.isInteger(year) && year > 1900) {
    return `${year}-01-01`;
  }

  return null;
}

function splitSqlBatches(sqlText) {
  return sqlText
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((part) => part.trim())
    .filter(Boolean);
}

async function runSqlFile(pool, root, relativePath) {
  const sqlText = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const batch of splitSqlBatches(sqlText)) {
    await pool.request().batch(batch);
  }
}

function readWorkbook(filePath) {
  const pythonCode = String.raw`
import json
import sys
from datetime import date, datetime
from openpyxl import load_workbook

file_path = sys.argv[1]
wb = load_workbook(file_path, data_only=True)
ws = wb[wb.sheetnames[0]]

headers = [ws.cell(row=1, column=c).value for c in range(1, ws.max_column + 1)]
rows = []

def serialize(value):
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    return value

for r in range(2, ws.max_row + 1):
    row = []
    for c in range(1, ws.max_column + 1):
        row.append(serialize(ws.cell(row=r, column=c).value))
    rows.append(row)

print(json.dumps({
    "sheet": ws.title,
    "headers": [str(h) if h is not None else None for h in headers],
    "rows": rows,
}, ensure_ascii=False))
`;

  const result = spawnSync("python", ["-X", "utf8", "-c", pythonCode, filePath], {
    encoding: "utf8",
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
    },
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || "No fue posible leer el archivo Excel.");
  }

  return JSON.parse(result.stdout);
}

function mapWorkbookRows(rows) {
  return rows
    .map((row) => {
      const af = row[0];
      const oc = row[1];
      const descripcion = row[2];
      const tipoNombre = row[3];
      const marcaNombre = row[4];
      const modelo = row[5];
      const seriePatente = row[6];
      const observacion = row[7];
      const numeroFactura = row[8];
      const fechaCell = row[9];
      const valor = row[10];
      const propioLeasing = row[11];
      const totalmenteDepreciado = row[12];
      const grupoNombre = row[13];
      const yearValue = row[14];
      const derivedDateFromYear = !fechaCell && toNumberValue(yearValue) !== null;
      const fechaFactura = excelToDate(fechaCell, yearValue);

      return {
        AF: toStringValue(af),
        OC: toStringValue(oc),
        Descripcion: toStringValue(descripcion),
        TipoNombre: toStringValue(tipoNombre),
        MarcaNombre: toStringValue(marcaNombre),
        Modelo: toStringValue(modelo),
        SeriePatente: toStringValue(seriePatente),
        NumeroFactura: toStringValue(numeroFactura),
        FechaFactura: fechaFactura,
        Valor: toNumberValue(valor),
        PropioLeasing: toStringValue(propioLeasing),
        TotalmenteDepreciado: toBooleanValue(totalmenteDepreciado) ?? false,
        Observacion: toStringValue(observacion),
        GrupoNombre: toStringValue(grupoNombre),
        derivedDateFromYear,
      };
    })
    .filter((row) => row.AF && row.Descripcion);
}

function buildCanonicalCatalogNames(mappedRows) {
  const catalogs = {
    TipoNombre: new Map(),
    MarcaNombre: new Map(),
    GrupoNombre: new Map(),
  };

  for (const row of mappedRows) {
    if (row.TipoNombre) {
      const key = normalizeText(row.TipoNombre);
      if (!catalogs.TipoNombre.has(key)) {
        catalogs.TipoNombre.set(key, row.TipoNombre);
      }
    }

    if (row.MarcaNombre) {
      const key = normalizeText(row.MarcaNombre);
      if (!catalogs.MarcaNombre.has(key)) {
        catalogs.MarcaNombre.set(key, row.MarcaNombre);
      }
    }

    if (row.GrupoNombre) {
      const key = normalizeText(row.GrupoNombre);
      if (!catalogs.GrupoNombre.has(key)) {
        catalogs.GrupoNombre.set(key, row.GrupoNombre);
      }
    }
  }

  return catalogs;
}

async function main() {
  const root = process.cwd();
  const args = process.argv.slice(2);
  const excelPath = args.find((arg) => !arg.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const createCatalogs = !args.includes("--no-create-catalogs");
  const updateExisting = args.includes("--update-existing");
  const repairCatalogs = !args.includes("--no-repair-catalogs");

  if (!excelPath) {
    throw new Error(
      'Uso: npm run import:activos-fijos -- "C:\\ruta\\Libro1.xlsx" [--dry-run] [--no-create-catalogs]',
    );
  }

  const resolvedExcelPath = path.isAbsolute(excelPath)
    ? excelPath
    : path.join(root, excelPath);

  if (!fs.existsSync(resolvedExcelPath)) {
    throw new Error(`No existe el archivo: ${resolvedExcelPath}`);
  }

  const env = loadEnv(path.join(root, ".env.local"));
  const config = {
    user: env.SQL_USER ?? "",
    password: env.SQL_PASSWORD ?? "",
    server: env.SQL_SERVER,
    port: Number(env.SQL_PORT ?? 1433),
    database: env.SQL_DATABASE,
    options: {
      encrypt: env.SQL_ENCRYPT === "true",
      trustServerCertificate: env.SQL_TRUST_CERT === "true",
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  if (!config.server || !config.database) {
    throw new Error("Faltan variables de conexion en .env.local");
  }

  const workbook = readWorkbook(resolvedExcelPath);
  const mappedRows = mapWorkbookRows(workbook.rows ?? []);
  const canonicalCatalogNames = buildCanonicalCatalogNames(mappedRows);

  const pool = await sql.connect(config);
  let transaction = null;

  try {
    if (!dryRun) {
      await runSqlFile(pool, root, "sql/create-activos-fijos-table.sql");
    }

    const existingActivos = await pool.request().query(`
      SELECT LTRIM(RTRIM(AF)) AS AF
      FROM dbo.ActivosFijos
    `);
    const existingAfSet = new Set(
      existingActivos.recordset
        .map((row) => normalizeText(row.AF))
        .filter(Boolean),
    );

    const catalogDefs = [
      { key: "TipoNombre", table: "dbo.ActivosFijosTipos" },
      { key: "MarcaNombre", table: "dbo.ActivosFijosMarcas" },
      { key: "GrupoNombre", table: "dbo.ActivosFijosGruposContables" },
    ];

    const catalogMaps = Object.fromEntries(
      await Promise.all(
        catalogDefs.map(async (def) => {
          const result = await pool.request().query(`
            SELECT Id, Nombre
            FROM ${def.table}
          `);

          return [
            def.key,
            new Map(result.recordset.map((item) => [normalizeText(item.Nombre), item.Id])),
          ];
        }),
      ),
    );

    const stats = {
      totalRows: mappedRows.length,
      inserted: 0,
      skippedDuplicates: 0,
      createdCatalogItems: 0,
      createdDatesFromYear: 0,
    };

    if (dryRun) {
      const missingTypes = new Set();
      const missingBrands = new Set();
      const missingGroups = new Set();

      for (const row of mappedRows) {
        if (row.TipoNombre && !catalogMaps.TipoNombre.has(normalizeText(row.TipoNombre))) {
          missingTypes.add(row.TipoNombre);
        }
        if (row.MarcaNombre && !catalogMaps.MarcaNombre.has(normalizeText(row.MarcaNombre))) {
          missingBrands.add(row.MarcaNombre);
        }
        if (row.GrupoNombre && !catalogMaps.GrupoNombre.has(normalizeText(row.GrupoNombre))) {
          missingGroups.add(row.GrupoNombre);
        }
        if (row.derivedDateFromYear) {
          stats.createdDatesFromYear += 1;
        }
      }

      console.log(
        JSON.stringify(
          {
            ok: true,
            dryRun: true,
            workbook: workbook.sheet,
            stats,
            missingCatalogs: {
              tipos: [...missingTypes].sort(),
              marcas: [...missingBrands].sort(),
              gruposContables: [...missingGroups].sort(),
            },
          },
          null,
          2,
        ),
      );
      return;
    }

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    if (repairCatalogs) {
      const catalogRepairDefs = [
        { key: "TipoNombre", table: "dbo.ActivosFijosTipos" },
        { key: "MarcaNombre", table: "dbo.ActivosFijosMarcas" },
        { key: "GrupoNombre", table: "dbo.ActivosFijosGruposContables" },
      ];

      for (const def of catalogRepairDefs) {
        const rowsToRepair = await transaction.request().query(`
          SELECT Id, Nombre
          FROM ${def.table}
        `);

        for (const item of rowsToRepair.recordset) {
          const normalized = normalizeText(item.Nombre);
          const canonical = canonicalCatalogNames[def.key].get(normalized);
          if (canonical && canonical !== item.Nombre) {
            await transaction
              .request()
              .input("id", sql.Int, item.Id)
              .input("nombre", sql.NVarChar(200), canonical)
              .query(`
                UPDATE ${def.table}
                SET Nombre = @nombre
                WHERE Id = @id
              `);
          }
        }
      }
    }

    async function resolveCatalogId(def, value) {
      if (!value) {
        return null;
      }

      const map = catalogMaps[def.key];
      const normalized = normalizeText(value);
      if (map.has(normalized)) {
        return map.get(normalized);
      }

      if (!createCatalogs) {
        return null;
      }

      const insertResult = await transaction
        .request()
        .input("nombre", sql.NVarChar(200), value.trim())
        .query(`
          INSERT INTO ${def.table} (Nombre)
          OUTPUT INSERTED.Id
          VALUES (@nombre)
        `);

      const newId = insertResult.recordset[0]?.Id ?? null;
      if (newId) {
        map.set(normalized, newId);
        stats.createdCatalogItems += 1;
      }

      return newId;
    }

    for (const row of mappedRows) {
      const afKey = normalizeText(row.AF);
      const exists = existingAfSet.has(afKey);

      const tipoId = await resolveCatalogId(
        { key: "TipoNombre", table: "dbo.ActivosFijosTipos" },
        row.TipoNombre,
      );
      const marcaId = await resolveCatalogId(
        { key: "MarcaNombre", table: "dbo.ActivosFijosMarcas" },
        row.MarcaNombre,
      );
      const grupoId = await resolveCatalogId(
        { key: "GrupoNombre", table: "dbo.ActivosFijosGruposContables" },
        row.GrupoNombre,
      );

      if (row.derivedDateFromYear) {
        stats.createdDatesFromYear += 1;
      }

      if (exists && !updateExisting) {
        stats.skippedDuplicates += 1;
        continue;
      }

      const request = transaction
        .request()
        .input("af", sql.NVarChar(50), row.AF)
        .input("oc", sql.NVarChar(50), row.OC)
        .input("descripcion", sql.NVarChar(500), row.Descripcion)
        .input("tipoId", sql.Int, tipoId)
        .input("marcaId", sql.Int, marcaId)
        .input("modelo", sql.NVarChar(200), row.Modelo)
        .input("seriePatente", sql.NVarChar(100), row.SeriePatente)
        .input("numeroFactura", sql.NVarChar(50), row.NumeroFactura)
        .input("fechaFactura", sql.Date, row.FechaFactura)
        .input("valor", sql.Decimal(18, 2), row.Valor)
        .input("propioLeasing", sql.NVarChar(20), row.PropioLeasing)
        .input("totalmenteDepreciado", sql.Bit, row.TotalmenteDepreciado)
        .input("anio", sql.Int, row.FechaFactura ? Number(row.FechaFactura.slice(0, 4)) : null)
        .input("observacion", sql.NVarChar(sql.MAX), row.Observacion)
        .input("grupoId", sql.Int, grupoId);

      if (exists) {
        await request.query(`
          UPDATE dbo.ActivosFijos
          SET
            OC = @oc,
            Descripcion = @descripcion,
            TipoActivoId = @tipoId,
            MarcaId = @marcaId,
            Modelo = @modelo,
            SeriePatente = @seriePatente,
            NumeroFactura = @numeroFactura,
            FechaFactura = @fechaFactura,
            Valor = @valor,
            PropioLeasing = @propioLeasing,
            TotalmenteDepreciado = @totalmenteDepreciado,
            Anio = @anio,
            Observacion = @observacion,
            GrupoContableId = @grupoId,
            ActualizadoEn = SYSUTCDATETIME()
          WHERE AF = @af
        `);
      } else {
        await request.query(`
          INSERT INTO dbo.ActivosFijos
            (
              AF,
              OC,
              Descripcion,
              TipoActivoId,
              MarcaId,
              Modelo,
              SeriePatente,
              NumeroFactura,
              FechaFactura,
              Valor,
              PropioLeasing,
              TotalmenteDepreciado,
              Anio,
              Observacion,
              GrupoContableId
            )
          VALUES
            (
              @af,
              @oc,
              @descripcion,
              @tipoId,
              @marcaId,
              @modelo,
              @seriePatente,
              @numeroFactura,
              @fechaFactura,
              @valor,
              @propioLeasing,
              @totalmenteDepreciado,
              @anio,
              @observacion,
              @grupoId
            )
        `);

        existingAfSet.add(afKey);
        stats.inserted += 1;
      }
    }

    await transaction.commit();
    console.log(JSON.stringify({ ok: true, ...stats }, null, 2));
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch {
        // ignore rollback failures during cleanup
      }
    }
    throw error;
  } finally {
    await pool.close();
  }
}

await main();
