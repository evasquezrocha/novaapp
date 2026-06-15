import fs from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

type ZipEntry = {
  fileName: string;
  content: Uint8Array;
};

function readUInt16LE(buffer: Uint8Array, offset: number) {
  return buffer[offset] | (buffer[offset + 1] << 8);
}

function readUInt32LE(buffer: Uint8Array, offset: number) {
  return (
    buffer[offset] |
    (buffer[offset + 1] << 8) |
    (buffer[offset + 2] << 16) |
    (buffer[offset + 3] << 24)
  ) >>> 0;
}

function bytesToString(bytes: Uint8Array) {
  return new TextDecoder("utf-8").decode(bytes);
}

function findEndOfCentralDirectory(buffer: Uint8Array) {
  const signature = 0x06054b50;

  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (readUInt32LE(buffer, offset) === signature) {
      return offset;
    }
  }

  throw new Error("No se encontró el directorio central del archivo ZIP.");
}

function parseZip(buffer: Uint8Array) {
  const endOffset = findEndOfCentralDirectory(buffer);
  const centralDirectorySize = readUInt32LE(buffer, endOffset + 12);
  const centralDirectoryOffset = readUInt32LE(buffer, endOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;
  const limit = centralDirectoryOffset + centralDirectorySize;

  while (offset < limit) {
    if (readUInt32LE(buffer, offset) !== 0x02014b50) {
      throw new Error("ZIP inválido: entrada del directorio central no reconocida.");
    }

    const compressionMethod = readUInt16LE(buffer, offset + 10);
    const compressedSize = readUInt32LE(buffer, offset + 20);
    const fileNameLength = readUInt16LE(buffer, offset + 28);
    const extraLength = readUInt16LE(buffer, offset + 30);
    const commentLength = readUInt16LE(buffer, offset + 32);
    const localHeaderOffset = readUInt32LE(buffer, offset + 42);
    const fileName = bytesToString(buffer.slice(offset + 46, offset + 46 + fileNameLength));

    const localHeaderSignature = readUInt32LE(buffer, localHeaderOffset);
    if (localHeaderSignature !== 0x04034b50) {
      throw new Error(`ZIP inválido: no se encontró la cabecera local de ${fileName}.`);
    }

    const localFileNameLength = readUInt16LE(buffer, localHeaderOffset + 26);
    const localExtraLength = readUInt16LE(buffer, localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedBytes = buffer.slice(dataOffset, dataOffset + compressedSize);

    let content: Uint8Array;
    if (compressionMethod === 0) {
      content = compressedBytes;
    } else if (compressionMethod === 8) {
      content = inflateRawSync(compressedBytes);
    } else {
      throw new Error(`ZIP inválido: método de compresión ${compressionMethod} no soportado.`);
    }

    entries.push({ fileName, content });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractSheetNames(workbookXml: string) {
  const sheetNames: string[] = [];
  const sheetRegex = /<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g;
  let match: RegExpExecArray | null;

  while ((match = sheetRegex.exec(workbookXml))) {
    sheetNames.push(decodeXmlEntities(match[1]));
  }

  return sheetNames;
}

function extractSheetTargets(workbookRelsXml: string) {
  const targets: string[] = [];
  const relRegex = /<Relationship\b[^>]*Type="[^"]*\/worksheet"[^>]*Target="([^"]+)"[^>]*\/>/g;
  let match: RegExpExecArray | null;

  while ((match = relRegex.exec(workbookRelsXml))) {
    targets.push(match[1]);
  }

  return targets;
}

function parseSharedStrings(xml: string) {
  const values: string[] = [];
  const regex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml))) {
    const text = match[1]
      .replace(/<t[^>]*>/g, "")
      .replace(/<\/t>/g, "")
      .replace(/<[^>]+>/g, "");
    values.push(decodeXmlEntities(text));
  }

  return values;
}

function cellColumnIndex(ref: string) {
  const letters = ref.replace(/\d+/g, "");
  let result = 0;
  for (const char of letters) {
    result = result * 26 + (char.toUpperCase().charCodeAt(0) - 64);
  }
  return result - 1;
}

function extractRowsFromSheet(xml: string, sharedStrings: string[]) {
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  const rows: string[][] = [];
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(xml))) {
    const rowXml = rowMatch[1];
    const cells: string[] = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowXml))) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2];
      const refMatch = /r="([^"]+)"/.exec(attrs);
      const typeMatch = /t="([^"]+)"/.exec(attrs);
      const ref = refMatch?.[1];
      const columnIndex = ref ? cellColumnIndex(ref) : cells.length;
      const type = typeMatch?.[1];

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

      cells[columnIndex] = value;
    }

    rows.push(cells);
  }

  return rows;
}

export async function readXlsxSheets(filePath: string) {
  const file = await fs.readFile(filePath);
  const entries = parseZip(file);
  const byName = new Map(entries.map((entry) => [entry.fileName, bytesToString(entry.content)]));

  const workbookXml = byName.get("xl/workbook.xml");
  const workbookRelsXml = byName.get("xl/_rels/workbook.xml.rels");

  if (!workbookXml || !workbookRelsXml) {
    throw new Error("El archivo Excel no contiene el libro requerido.");
  }

  const sheetNames = extractSheetNames(workbookXml);
  const sheetTargets = extractSheetTargets(workbookRelsXml);

  const sharedStrings = byName.has("xl/sharedStrings.xml")
    ? parseSharedStrings(byName.get("xl/sharedStrings.xml") ?? "")
    : [];

  const sheets = sheetTargets.map((target, index) => {
    const normalizedTarget = target.startsWith("xl/") ? target : `xl/${target}`;
    const sheetXml = byName.get(normalizedTarget);
    if (!sheetXml) {
      throw new Error(`No se encontró la hoja ${sheetNames[index] ?? normalizedTarget}.`);
    }

    return {
      name: sheetNames[index] ?? normalizedTarget,
      rows: extractRowsFromSheet(sheetXml, sharedStrings),
    };
  });

  return sheets;
}
