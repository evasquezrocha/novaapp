import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";

export const dynamic = "force-dynamic";

function isAllowedFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xlsm");
}

function runImportScript(filePath: string, dryRun: boolean) {
  const scriptPath = path.join(process.cwd(), "scripts", "import-sistema-otn.mjs");
  const args = [scriptPath, filePath];

  if (dryRun) {
    args.push("--dry-run");
  }

  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    const message =
      stderr || stdout || "No fue posible importar el archivo.";
    throw new Error(message.split(/\r?\n/).slice(0, 3).join("\n"));
  }

  const output = result.stdout.trim();
  if (!output) {
    throw new Error("El importador no devolvió respuesta.");
  }

  return JSON.parse(output) as unknown;
}

function normalizePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  const stats =
    record.stats && typeof record.stats === "object"
      ? record.stats
      : {
          parentRows: record.parentRows,
          approvalRows: record.approvalRows,
          deliveryRows: record.deliveryRows,
          parentsInserted: record.parentsInserted,
          parentsUpdated: record.parentsUpdated,
          approvalsDeleted: record.approvalsDeleted,
          approvalsInserted: record.approvalsInserted,
          deliveriesDeleted: record.deliveriesDeleted,
          deliveriesInserted: record.deliveriesInserted,
        };

  return {
    ...record,
    stats,
  };
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permissions = await listPermissions();
  const canImport =
    session.Rol !== "Supervisor" &&
    (canAccess(permissions, session.Rol, "Administración") ||
      canAccess(permissions, session.Rol, "Permisos"));

  if (!canImport) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const dryRun = formData.get("dryRun") === "true";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Debes adjuntar un archivo Excel." }, { status: 400 });
  }

  if (!isAllowedFileName(file.name)) {
    return NextResponse.json(
      { error: "El archivo debe ser .xlsx o .xlsm." },
      { status: 400 },
    );
  }

  const tempFilePath = path.join(
    os.tmpdir(),
    `nova-sistema-otn-${randomUUID()}${path.extname(file.name)}`,
  );

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempFilePath, buffer);

    const payload = runImportScript(tempFilePath, dryRun);
    return NextResponse.json(normalizePayload(payload));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible procesar la importación.",
      },
      { status: 500 },
    );
  } finally {
    await fs.rm(tempFilePath, { force: true }).catch(() => undefined);
  }
}
