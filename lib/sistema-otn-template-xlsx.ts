const SHEETS = [
  {
    name: "sistema-otn",
    headers: [
      "OTN",
      "Estado",
      "FechaIngreso",
      "Cliente",
      "Empresa",
      "EntregaFuente",
      "Solicitante",
      "CC",
      "Cantidad",
      "Descripcion",
      "ReferenciaCliente",
      "Cotizador",
      "Equipo",
      "FechaPpto",
      "ValorPpto",
      "Plazo",
      "Observaciones",
      "Ruta",
    ],
  },
  {
    name: "sistema-otn-aprobaciones",
    headers: ["OTN", "FechaAprobacion", "ValorAprobado", "OC", "ReferenciaCliente"],
  },
  {
    name: "sistema-otn-entregas-manuales",
    headers: ["OTN", "FechaEntrega", "ValorEntrega", "ReferenciaEntrega"],
  },
] as const;

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number) {
  let current = index + 1;
  let result = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}

function crc32(bytes: Uint8Array) {
  const table = crc32Table();
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

let cachedCrcTable: number[] | null = null;

function crc32Table() {
  if (cachedCrcTable) {
    return cachedCrcTable;
  }

  const table: number[] = [];

  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }

  cachedCrcTable = table;
  return table;
}

function writeUint16LE(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32LE(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function concatBytes(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function dosDateTime() {
  const now = new Date();
  const year = Math.max(1980, now.getFullYear());
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = Math.floor(now.getSeconds() / 2);

  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;

  return { dosDate, dosTime };
}

function utf8Bytes(value: string) {
  return new TextEncoder().encode(value);
}

function createZipEntry(fileName: string, content: Uint8Array) {
  const fileNameBytes = utf8Bytes(fileName);
  const { dosDate, dosTime } = dosDateTime();
  const crc = crc32(content);
  const size = content.length;

  const localHeader = new Uint8Array(30 + fileNameBytes.length);
  writeUint32LE(localHeader, 0, 0x04034b50);
  writeUint16LE(localHeader, 4, 20);
  writeUint16LE(localHeader, 6, 0);
  writeUint16LE(localHeader, 8, 0);
  writeUint16LE(localHeader, 10, dosTime);
  writeUint16LE(localHeader, 12, dosDate);
  writeUint32LE(localHeader, 14, crc);
  writeUint32LE(localHeader, 18, size);
  writeUint32LE(localHeader, 22, size);
  writeUint16LE(localHeader, 26, fileNameBytes.length);
  writeUint16LE(localHeader, 28, 0);
  localHeader.set(fileNameBytes, 30);

  const centralHeader = new Uint8Array(46 + fileNameBytes.length);
  writeUint32LE(centralHeader, 0, 0x02014b50);
  writeUint16LE(centralHeader, 4, 20);
  writeUint16LE(centralHeader, 6, 20);
  writeUint16LE(centralHeader, 8, 0);
  writeUint16LE(centralHeader, 10, 0);
  writeUint16LE(centralHeader, 12, dosTime);
  writeUint16LE(centralHeader, 14, dosDate);
  writeUint32LE(centralHeader, 16, crc);
  writeUint32LE(centralHeader, 20, size);
  writeUint32LE(centralHeader, 24, size);
  writeUint16LE(centralHeader, 28, fileNameBytes.length);
  writeUint16LE(centralHeader, 30, 0);
  writeUint16LE(centralHeader, 32, 0);
  writeUint16LE(centralHeader, 34, 0);
  writeUint16LE(centralHeader, 36, 0);
  writeUint32LE(centralHeader, 38, 0);
  writeUint32LE(centralHeader, 42, 0);
  centralHeader.set(fileNameBytes, 46);

  return {
    localHeader,
    content,
    centralHeader,
    size: localHeader.length + content.length,
  };
}

function createZipBuffer(entries: { fileName: string; content: Uint8Array }[]) {
  const chunks: Uint8Array[] = [];
  const centralEntries: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const zipEntry = createZipEntry(entry.fileName, entry.content);
    chunks.push(zipEntry.localHeader, zipEntry.content);

    const central = new Uint8Array(zipEntry.centralHeader);
    writeUint32LE(central, 42, offset);
    centralEntries.push(central);
    offset += zipEntry.size;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = concatBytes(centralEntries);
  const endOfDirectory = new Uint8Array(22);
  writeUint32LE(endOfDirectory, 0, 0x06054b50);
  writeUint16LE(endOfDirectory, 4, 0);
  writeUint16LE(endOfDirectory, 6, 0);
  writeUint16LE(endOfDirectory, 8, entries.length);
  writeUint16LE(endOfDirectory, 10, entries.length);
  writeUint32LE(endOfDirectory, 12, centralDirectory.length);
  writeUint32LE(endOfDirectory, 16, centralDirectoryOffset);
  writeUint16LE(endOfDirectory, 20, 0);

  return concatBytes([...chunks, centralDirectory, endOfDirectory]);
}

function buildSheetXml(headers: readonly string[]) {
  const cells = headers
    .map(
      (header, index) =>
        `<c r="${columnName(index)}1" t="inlineStr"><is><t>${xmlEscape(header)}</t></is></c>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>
    <row r="1">${cells}</row>
  </sheetData>
</worksheet>`;
}

export async function buildSistemaOtnTemplateXlsx() {
  const entries = [
    {
      fileName: "[Content_Types].xml",
      content: utf8Bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${SHEETS.map(
    (_sheet, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("\n  ")}
</Types>`),
    },
    {
      fileName: "_rels/.rels",
      content: utf8Bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    },
    {
      fileName: "xl/workbook.xml",
      content: utf8Bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${SHEETS.map(
      (sheet, index) =>
        `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    ).join("\n    ")}
  </sheets>
</workbook>`),
    },
    {
      fileName: "xl/_rels/workbook.xml.rels",
      content: utf8Bytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${SHEETS.map(
    (_sheet, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("\n  ")}
</Relationships>`),
    },
    ...SHEETS.map((sheet, index) => ({
      fileName: `xl/worksheets/sheet${index + 1}.xml`,
      content: utf8Bytes(buildSheetXml(sheet.headers)),
    })),
  ];

  return createZipBuffer(entries);
}

export function getSistemaOtnTemplateFilename() {
  return "plantilla-importacion-sistema-otn.xlsx";
}
