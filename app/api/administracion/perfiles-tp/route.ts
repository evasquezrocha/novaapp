import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import {
  createPerfilTpRows,
  generatePerfilTpCodigoAleatorio,
  listPerfilTpRows,
  type PerfilTpInput,
} from "@/lib/perfiles-tp-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";

export const dynamic = "force-dynamic";

async function assertAccess() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    return { response: NextResponse.json({ error: "No autorizado." }, { status: 401 }) };
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Administración")) {
    return { response: NextResponse.json({ error: "No autorizado." }, { status: 403 }) };
  }

  return { session };
}

export async function GET() {
  const access = await assertAccess();
  if ("response" in access) {
    return access.response;
  }

  try {
    const rows = await listPerfilTpRows();
    return NextResponse.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible listar los perfiles.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await assertAccess();
  if ("response" in access) {
    return access.response;
  }

  try {
    const body = (await request.json()) as {
      rows?: Array<{
        Empresa?: string;
        Logo?: string | null;
        Nombre?: string;
        Contacto?: string | null;
        WhatsApp?: string | null;
        Telefono?: string | null;
        Web?: string | null;
        Instagram?: string | null;
        LinkedIn?: string | null;
        Transferencia?: string | null;
        CodigoAleatorio?: string | null;
      }>;
    };

    const rows = body.rows ?? [];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Debes enviar al menos una fila." }, { status: 400 });
    }

    const normalizedRows: PerfilTpInput[] = rows.map((row, index) => {
      const empresa = row.Empresa?.trim();
      const nombre = row.Nombre?.trim();

      if (!empresa) {
        throw new Error(`La fila ${index + 1} requiere Empresa.`);
      }

      if (!nombre) {
        throw new Error(`La fila ${index + 1} requiere Nombre.`);
      }

      return {
        Empresa: empresa,
        Logo: row.Logo?.trim() || null,
        Nombre: nombre,
        Contacto: row.Contacto?.trim() || null,
        WhatsApp: row.WhatsApp?.trim() || null,
        Telefono: row.Telefono?.trim() || null,
        Web: row.Web?.trim() || null,
        Instagram: row.Instagram?.trim() || null,
        LinkedIn: row.LinkedIn?.trim() || null,
        Transferencia: row.Transferencia?.trim() || null,
        CodigoAleatorio: row.CodigoAleatorio?.trim() || generatePerfilTpCodigoAleatorio(),
      };
    });

    await createPerfilTpRows(normalizedRows);
    return NextResponse.json({ ok: true, created: normalizedRows.length }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible guardar el perfil.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

