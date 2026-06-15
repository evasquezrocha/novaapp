import fs from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
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

function toText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeDateParts(year, month, day, fieldName, rowIndex, sourceName) {
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const valid =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  if (!valid) {
    throw new Error(`${sourceName}: fila ${rowIndex + 2}, ${fieldName} no es una fecha válida.`);
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeExcelSerialDate(serial, fieldName, rowIndex, sourceName) {
  if (!Number.isFinite(serial)) {
    throw new Error(`${sourceName}: fila ${rowIndex + 2}, ${fieldName} no es una fecha válida.`);
  }

  const wholeDays = Math.trunc(serial);
  const fraction = serial - wholeDays;
  const adjustedDays = wholeDays >= 60 ? wholeDays - 1 : wholeDays;
  const utcMillis = Date.UTC(1899, 11, 31) + adjustedDays * 86400000 + Math.round(fraction * 86400000);
  const parsed = new Date(utcMillis);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${sourceName}: fila ${rowIndex + 2}, ${fieldName} no es una fecha válida.`);
  }

  return normalizeDateParts(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth() + 1,
    parsed.getUTCDate(),
    fieldName,
    rowIndex,
    sourceName,
  );
}

function toDate(value, fieldName, rowIndex, sourceName) {
  const text = toText(value);
  if (!text) {
    return null;
  }

  const dmy = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) {
    return normalizeDateParts(
      Number(dmy[3]),
      Number(dmy[2]),
      Number(dmy[1]),
      fieldName,
      rowIndex,
      sourceName,
    );
  }

  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    return normalizeDateParts(
      Number(ymd[1]),
      Number(ymd[2]),
      Number(ymd[3]),
      fieldName,
      rowIndex,
      sourceName,
    );
  }

  if (/^\d+(?:\.\d+)?$/.test(text)) {
    return normalizeExcelSerialDate(Number(text), fieldName, rowIndex, sourceName);
  }

  throw new Error(
    `${sourceName}: fila ${rowIndex + 2}, ${fieldName} debe usar formato DD-MM-YYYY, YYYY-MM-DD o un serial de Excel válido.`,
  );
}

function toNumber(value, fieldName, rowIndex, sourceName, required = false) {
  const text = toText(value);
  if (!text) {
    if (required) {
      throw new Error(`${sourceName}: fila ${rowIndex + 2}, ${fieldName} es obligatoria.`);
    }
    return null;
  }

  const parsed = Number(text.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    throw new Error(`${sourceName}: fila ${rowIndex + 2}, ${fieldName} debe ser numérico.`);
  }

  return parsed;
}

function normalizeEntregaFuente(value) {
  const normalized = toText(value)?.toLowerCase();
  return normalized === "manual" ? "manual" : "sap";
}

function normalizeEquipo(value) {
  const normalized = toText(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["no", "n", "false", "0"].includes(normalized)) {
    return "No";
  }

  return "Sí";
}

function normalizeEstado(value) {
  return toText(value) ?? "Ingresado";
}

function normalizeEmpresa(value) {
  return toText(value);
}

function normalizeOptionalText(value) {
  return toText(value);
}

function canonicalizeHeader(value) {
  return toText(value)?.toLowerCase() ?? "";
}

function indexHeaders(headers) {
  const map = new Map();
  headers.forEach((header, index) => {
    const key = canonicalizeHeader(header);
    if (key && !map.has(key)) {
      map.set(key, index);
    }
  });
  return map;
}

function getCell(headers, row, fieldName) {
  const index = headers.get(fieldName.toLowerCase());
  if (index === undefined) {
    return undefined;
  }

  return row[index];
}

function rowHasAnyValue(row) {
  return row.some((value) => toText(value) !== null);
}

function readUInt16LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8);
}

function readUInt32LE(buffer, offset) {
  return (
    buffer[offset] |
    (buffer[offset + 1] << 8) |
    (buffer[offset + 2] << 16) |
    (buffer[offset + 3] << 24)
  ) >>> 0;
}

function bytesToString(bytes) {
  return Buffer.from(bytes).toString("utf8");
}

function decodeXmlEntities(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (readUInt32LE(buffer, offset) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error("No se encontró el directorio central del archivo Excel.");
}

function parseZip(buffer) {
  const endOffset = findEndOfCentralDirectory(buffer);
  const centralDirectorySize = readUInt32LE(buffer, endOffset + 12);
  const centralDirectoryOffset = readUInt32LE(buffer, endOffset + 16);
  const limit = centralDirectoryOffset + centralDirectorySize;
  const entries = new Map();
  let offset = centralDirectoryOffset;

  while (offset < limit) {
    if (readUInt32LE(buffer, offset) !== 0x02014b50) {
      throw new Error("ZIP inválido: directorio central corrupto.");
    }

    const compressionMethod = readUInt16LE(buffer, offset + 10);
    const compressedSize = readUInt32LE(buffer, offset + 20);
    const fileNameLength = readUInt16LE(buffer, offset + 28);
    const extraLength = readUInt16LE(buffer, offset + 30);
    const commentLength = readUInt16LE(buffer, offset + 32);
    const localHeaderOffset = readUInt32LE(buffer, offset + 42);
    const fileName = bytesToString(
      buffer.slice(offset + 46, offset + 46 + fileNameLength),
    );

    const localHeaderSignature = readUInt32LE(buffer, localHeaderOffset);
    if (localHeaderSignature !== 0x04034b50) {
      throw new Error(`ZIP inválido: no se encontró la cabecera local de ${fileName}.`);
    }

    const localFileNameLength = readUInt16LE(buffer, localHeaderOffset + 26);
    const localExtraLength = readUInt16LE(buffer, localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedBytes = buffer.slice(dataOffset, dataOffset + compressedSize);

    let content;
    if (compressionMethod === 0) {
      content = compressedBytes;
    } else if (compressionMethod === 8) {
      content = inflateRawSync(compressedBytes);
    } else {
      throw new Error(`ZIP inválido: método de compresión ${compressionMethod} no soportado.`);
    }

    entries.set(fileName, content);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function columnIndexFromRef(ref) {
  const letters = ref.replace(/\d+/g, "");
  let result = 0;
  for (const char of letters) {
    result = result * 26 + (char.toUpperCase().charCodeAt(0) - 64);
  }
  return result - 1;
}

function parseSharedStrings(xml) {
  const values = [];
  const regex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match;

  while ((match = regex.exec(xml))) {
    const text = match[1]
      .replace(/<t[^>]*>/g, "")
      .replace(/<\/t>/g, "")
      .replace(/<[^>]+>/g, "");
    values.push(decodeXmlEntities(text));
  }

  return values;
}

function extractRowsFromSheet(xml, sharedStrings) {
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  const rows = [];
  let rowMatch;

  while ((rowMatch = rowRegex.exec(xml))) {
    const rowXml = rowMatch[1];
    const row = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowXml))) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2];
      const refMatch = /r="([^"]+)"/.exec(attrs);
      const typeMatch = /t="([^"]+)"/.exec(attrs);
      const ref = refMatch?.[1];
      const type = typeMatch?.[1];
      const columnIndex = ref ? columnIndexFromRef(ref) : row.length;

      let value = "";
      if (type === "inlineStr") {
        const inlineMatch = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);
        value = inlineMatch ? decodeXmlEntities(inlineMatch[1]) : "";
      } else if (type === "s") {
        const sharedMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
        const sharedIndex = sharedMatch ? Number(sharedMatch[1]) : NaN;
        value = Number.isInteger(sharedIndex) ? sharedStrings[sharedIndex] ?? "" : "";
      } else {
        const valueMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
        value = valueMatch ? decodeXmlEntities(valueMatch[1]) : "";
      }

      row[columnIndex] = value;
    }

    rows.push(row);
  }

  return rows;
}

function readCsvTable(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, index) => line.length > 0 || index === 0);

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const parseLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
        continue;
      }

      current += char;
    }

    result.push(current);
    return result.map((value) => value.replace(/^\uFEFF/, "").trim());
  };

  return {
    headers: parseLine(rows[0]),
    rows: rows.slice(1).map(parseLine).filter(rowHasAnyValue),
  };
}

function normalizeSourceBundle(bundle) {
  const parents = bundle.tables["sistema-otn"];
  const approvals = bundle.tables["sistema-otn-aprobaciones"] ?? { headers: [], rows: [] };
  const manualDeliveries = bundle.tables["sistema-otn-entregas-manuales"] ?? {
    headers: [],
    rows: [],
  };

  if (!parents) {
    throw new Error("No se encontro la tabla sistema-otn.");
  }
  const parentRows = parents.rows.map((row, rowIndex) => {
    const headers = indexHeaders(parents.headers);
    const otn = toText(getCell(headers, row, "OTN"));
    if (!otn) {
      throw new Error(`sistema-otn: fila ${rowIndex + 2}, OTN es obligatoria.`);
    }

    return {
      OTN: otn,
      Estado: normalizeEstado(getCell(headers, row, "Estado")),
      FechaIngreso: toDate(getCell(headers, row, "FechaIngreso"), "FechaIngreso", rowIndex, "sistema-otn"),
      Cliente: normalizeOptionalText(getCell(headers, row, "Cliente")),
      Empresa: normalizeEmpresa(getCell(headers, row, "Empresa")),
      EntregaFuente: normalizeEntregaFuente(getCell(headers, row, "EntregaFuente")),
      Solicitante: normalizeOptionalText(getCell(headers, row, "Solicitante")),
      CC: normalizeOptionalText(getCell(headers, row, "CC")),
      Cantidad: toNumber(getCell(headers, row, "Cantidad"), "Cantidad", rowIndex, "sistema-otn"),
      Descripcion: normalizeOptionalText(getCell(headers, row, "Descripcion")),
      ReferenciaCliente: normalizeOptionalText(getCell(headers, row, "ReferenciaCliente")),
      Cotizador: normalizeOptionalText(getCell(headers, row, "Cotizador")),
      Equipo: normalizeEquipo(getCell(headers, row, "Equipo")) ?? "Sí",
      FechaPpto: toDate(getCell(headers, row, "FechaPpto"), "FechaPpto", rowIndex, "sistema-otn"),
      ValorPpto: toNumber(getCell(headers, row, "ValorPpto"), "ValorPpto", rowIndex, "sistema-otn"),
      Plazo: normalizeOptionalText(getCell(headers, row, "Plazo")),
      Observaciones: normalizeOptionalText(getCell(headers, row, "Observaciones")),
      Ruta: normalizeOptionalText(getCell(headers, row, "Ruta")),
    };
  });

  const approvalRows = approvals.rows.map((row, rowIndex) => {
    const headers = indexHeaders(approvals.headers);
    const otn = toText(getCell(headers, row, "OTN"));
    if (!otn) {
      throw new Error(`sistema-otn-aprobaciones: fila ${rowIndex + 2}, OTN es obligatoria.`);
    }

    return {
      OTN: otn,
      FechaAprobacion: toDate(
        getCell(headers, row, "FechaAprobacion"),
        "FechaAprobacion",
        rowIndex,
        "sistema-otn-aprobaciones",
      ),
      ValorAprobado: toNumber(
        getCell(headers, row, "ValorAprobado"),
        "ValorAprobado",
        rowIndex,
        "sistema-otn-aprobaciones",
        true,
      ),
      OC: normalizeOptionalText(getCell(headers, row, "OC")),
      ReferenciaCliente: normalizeOptionalText(getCell(headers, row, "ReferenciaCliente")),
    };
  });

  const deliveryRows = manualDeliveries.rows.map((row, rowIndex) => {
    const headers = indexHeaders(manualDeliveries.headers);
    const otn = toText(getCell(headers, row, "OTN"));
    if (!otn) {
      throw new Error(`sistema-otn-entregas-manuales: fila ${rowIndex + 2}, OTN es obligatoria.`);
    }

    return {
      OTN: otn,
      FechaEntrega: toDate(
        getCell(headers, row, "FechaEntrega"),
        "FechaEntrega",
        rowIndex,
        "sistema-otn-entregas-manuales",
      ),
      ValorEntrega: toNumber(
        getCell(headers, row, "ValorEntrega"),
        "ValorEntrega",
        rowIndex,
        "sistema-otn-entregas-manuales",
        true,
      ),
      ReferenciaEntrega: normalizeOptionalText(getCell(headers, row, "ReferenciaEntrega")),
    };
  });

  return {
    parentRows,
    approvalRows,
    deliveryRows,
  };
}

function readInputBundle(sourcePath) {
  const source = path.resolve(sourcePath);
  const bundle = { source: null, tables: {} };
  const targets = [
    ["sistema-otn", "sistema-otn.csv", "sistema-otn", true],
    ["sistema-otn-aprobaciones", "sistema-otn-aprobaciones.csv", "sistema-otn-aprobaciones", false],
    [
      "sistema-otn-entregas-manuales",
      "sistema-otn-entregas-manuales.csv",
      "sistema-otn-entregas-manuales",
      false,
    ],
  ];

  if (fs.statSync(source).isDirectory()) {
    bundle.source = "directory";

    for (const [key, filename, , required] of targets) {
      const filePath = path.join(source, filename);
      if (!fs.existsSync(filePath)) {
        if (required) {
          throw new Error(`No existe el archivo requerido: ${filePath}`);
        }

        bundle.tables[key] = { headers: [], rows: [] };
        continue;
      }

      bundle.tables[key] = readCsvTable(filePath);
    }

    return bundle;
  }

  bundle.source = "file";

  if (![".xlsx", ".xlsm"].includes(path.extname(source).toLowerCase())) {
    throw new Error("El archivo debe ser .xlsx o .xlsm, o bien una carpeta con CSV.");
  }

  const zipEntries = parseZip(fs.readFileSync(source));
  const workbookXml = bytesToString(zipEntries.get("xl/workbook.xml") ?? new Uint8Array());
  const workbookRelsXml = bytesToString(
    zipEntries.get("xl/_rels/workbook.xml.rels") ?? new Uint8Array(),
  );

  if (!workbookXml || !workbookRelsXml) {
    throw new Error("El archivo Excel no contiene el libro requerido.");
  }

  const sheetNameByRelId = new Map(
    [...workbookXml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g)].map(
      (match) => [match[2], decodeXmlEntities(match[1])],
    ),
  );
  const targetByRelId = new Map(
    [...workbookRelsXml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g)].map(
      (match) => [match[1], match[2]],
    ),
  );
  const sharedStrings = zipEntries.has("xl/sharedStrings.xml")
    ? parseSharedStrings(bytesToString(zipEntries.get("xl/sharedStrings.xml")))
    : [];

  for (const [key, expectedFilename, expectedSheetName, required] of targets) {
    const relId = [...sheetNameByRelId.entries()].find(([, sheetName]) => sheetName === expectedSheetName)?.[0];
    const target = relId ? targetByRelId.get(relId) : null;

    if (!target) {
      if (required) {
        throw new Error(`No se encontró la hoja ${expectedSheetName} (${expectedFilename}).`);
      }

      bundle.tables[key] = { headers: [], rows: [] };
      continue;
    }

    const normalizedTarget = target.startsWith("xl/") ? target : `xl/${target}`;
    const sheetXml = bytesToString(zipEntries.get(normalizedTarget) ?? new Uint8Array());

    if (!sheetXml) {
      if (required) {
        throw new Error(`No se encontró la hoja ${expectedSheetName} (${expectedFilename}).`);
      }

      bundle.tables[key] = { headers: [], rows: [] };
      continue;
    }

    const parsedRows = extractRowsFromSheet(sheetXml, sharedStrings);
    bundle.tables[key] = {
      headers: parsedRows[0] ?? [],
      rows: parsedRows.slice(1).filter(rowHasAnyValue),
    };
  }

  return bundle;
}

async function main() {
  const root = process.cwd();
  const args = process.argv.slice(2);
  const sourceArg = args.find((arg) => !arg.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const replaceExisting = !args.includes("--append");

  if (!sourceArg) {
    throw new Error(
      'Uso: npm run import:sistema-otn -- "C:\\ruta\\carpeta-o-archivo.xlsx" [--dry-run] [--append]',
    );
  }

  const resolvedSourcePath = path.isAbsolute(sourceArg)
    ? sourceArg
    : path.join(root, sourceArg);

  if (!fs.existsSync(resolvedSourcePath)) {
    throw new Error(`No existe el origen de importacion: ${resolvedSourcePath}`);
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

  const bundle = readInputBundle(resolvedSourcePath);
  const { parentRows, approvalRows, deliveryRows } = normalizeSourceBundle(bundle);

  const parentByOtn = new Map();
  const duplicateParents = new Set();
  for (const row of parentRows) {
    if (parentByOtn.has(row.OTN)) {
      duplicateParents.add(row.OTN);
      continue;
    }
    parentByOtn.set(row.OTN, row);
  }

  if (duplicateParents.size > 0) {
    throw new Error(
      `OTN duplicadas en sistema-otn: ${[...duplicateParents].sort().join(", ")}`,
    );
  }

  const childOtns = new Set([
    ...approvalRows.map((row) => row.OTN),
    ...deliveryRows.map((row) => row.OTN),
  ]);
  const parentOtns = new Set(parentRows.map((row) => row.OTN));
  const validOtns = new Set([...parentOtns]);

  const pool = await sql.connect(config);
  let transaction = null;

  try {
    await runSqlFile(pool, root, "sql/create-sistema-otn-table.sql");
    await runSqlFile(pool, root, "sql/create-sistema-otn-aprobaciones-table.sql");
    await runSqlFile(pool, root, "sql/create-sistema-otn-entregas-manuales-table.sql");

    const existingParents = await pool.request().query(`
      SELECT LTRIM(RTRIM(OTN)) AS OTN
      FROM dbo.SistemaOtn
    `);
    for (const row of existingParents.recordset) {
      if (row.OTN) {
        validOtns.add(String(row.OTN).trim());
      }
    }

    const missingOtns = [...childOtns].filter((otn) => !validOtns.has(otn));
    if (missingOtns.length > 0) {
      throw new Error(
        `Las tablas relacionadas contienen OTN que no existen en Sistema OTN: ${missingOtns
          .sort()
          .join(", ")}`,
      );
    }

    const stats = {
      parentRows: parentRows.length,
      approvalRows: approvalRows.length,
      deliveryRows: deliveryRows.length,
      parentsInserted: 0,
      parentsUpdated: 0,
      approvalsDeleted: 0,
      approvalsInserted: 0,
      deliveriesDeleted: 0,
      deliveriesInserted: 0,
    };

    if (dryRun) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            dryRun: true,
            source: bundle.source,
            stats,
            validations: {
              duplicateParents: [...duplicateParents].sort(),
              missingRelatedOtNs: missingOtns.sort(),
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

    if (replaceExisting) {
      for (const otn of childOtns) {
        const approvalsDeleted = await transaction
          .request()
          .input("otn", sql.NVarChar(50), otn)
          .query(`
            DELETE FROM dbo.SistemaOtnAprobaciones
            WHERE OTN = @otn
          `);
        stats.approvalsDeleted += approvalsDeleted.rowsAffected[0] ?? 0;

        const deliveriesDeleted = await transaction
          .request()
          .input("otn", sql.NVarChar(50), otn)
          .query(`
            DELETE FROM dbo.SistemaOtnEntregasManuales
            WHERE OTN = @otn
          `);
        stats.deliveriesDeleted += deliveriesDeleted.rowsAffected[0] ?? 0;
      }
    }

    for (const row of parentRows) {
      const exists = await transaction
        .request()
        .input("otn", sql.NVarChar(50), row.OTN)
        .query(`
          SELECT TOP 1 Id
          FROM dbo.SistemaOtn
          WHERE OTN = @otn
        `);

      const request = transaction
        .request()
        .input("otn", sql.NVarChar(50), row.OTN)
        .input("estado", sql.NVarChar(60), row.Estado)
        .input("fechaIngreso", sql.Date, row.FechaIngreso)
        .input("cliente", sql.NVarChar(150), row.Cliente)
        .input("empresa", sql.NVarChar(50), row.Empresa)
        .input("entregaFuente", sql.NVarChar(10), row.EntregaFuente)
        .input("solicitante", sql.NVarChar(150), row.Solicitante)
        .input("cc", sql.NVarChar(80), row.CC)
        .input("cantidad", sql.Decimal(18, 2), row.Cantidad)
        .input("descripcion", sql.NVarChar(500), row.Descripcion)
        .input("referenciaCliente", sql.NVarChar(150), row.ReferenciaCliente)
        .input("cotizador", sql.NVarChar(150), row.Cotizador)
        .input("equipo", sql.NVarChar(150), row.Equipo)
        .input("fechaPpto", sql.Date, row.FechaPpto)
        .input("valorPpto", sql.Decimal(18, 2), row.ValorPpto)
        .input("plazo", sql.NVarChar(100), row.Plazo)
        .input("observaciones", sql.NVarChar(sql.MAX), row.Observaciones)
        .input("ruta", sql.NVarChar(255), row.Ruta);

      if ((exists.recordset[0] ?? null) !== null) {
        await request.query(`
          UPDATE dbo.SistemaOtn
          SET
            Estado = @estado,
            FechaIngreso = @fechaIngreso,
            Cliente = @cliente,
            Empresa = @empresa,
            EntregaFuente = @entregaFuente,
            Solicitante = @solicitante,
            CC = @cc,
            Cantidad = @cantidad,
            Descripcion = @descripcion,
            ReferenciaCliente = @referenciaCliente,
            Cotizador = @cotizador,
            Equipo = @equipo,
            FechaPpto = @fechaPpto,
            ValorPpto = @valorPpto,
            Plazo = @plazo,
            Observaciones = @observaciones,
            Ruta = @ruta,
            ActualizadoEn = SYSUTCDATETIME()
          WHERE OTN = @otn
        `);
        stats.parentsUpdated += 1;
      } else {
        await request.query(`
          INSERT INTO dbo.SistemaOtn
            (
              OTN,
              Estado,
              FechaIngreso,
              Cliente,
              Empresa,
              EntregaFuente,
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
              @fechaIngreso,
              @cliente,
              @empresa,
              @entregaFuente,
              @solicitante,
              @cc,
              @cantidad,
              @descripcion,
              @referenciaCliente,
              @cotizador,
              @equipo,
              @fechaPpto,
              @valorPpto,
              @plazo,
              @observaciones,
              @ruta
            )
        `);
        stats.parentsInserted += 1;
      }
    }

    for (const row of approvalRows) {
      await transaction
        .request()
        .input("otn", sql.NVarChar(50), row.OTN)
        .input("fechaAprobacion", sql.Date, row.FechaAprobacion)
        .input("valorAprobado", sql.Decimal(18, 2), row.ValorAprobado)
        .input("oc", sql.NVarChar(100), row.OC)
        .input("referenciaCliente", sql.NVarChar(150), row.ReferenciaCliente)
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
      stats.approvalsInserted += 1;
    }

    for (const row of deliveryRows) {
      await transaction
        .request()
        .input("otn", sql.NVarChar(50), row.OTN)
        .input("fechaEntrega", sql.Date, row.FechaEntrega)
        .input("valorEntrega", sql.Decimal(18, 2), row.ValorEntrega)
        .input("referenciaEntrega", sql.NVarChar(150), row.ReferenciaEntrega)
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
      stats.deliveriesInserted += 1;
    }

    await transaction.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          source: bundle.source,
          replaceExisting,
          ...stats,
        },
        null,
        2,
      ),
    );
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

main().catch((error) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "No fue posible importar el archivo.";

  console.error(message);
  process.exit(1);
});
