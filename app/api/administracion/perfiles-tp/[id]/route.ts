import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import {
  deletePerfilTpRow,
  getPerfilTpRowById,
  updatePerfilTpRowPartial,
  type PerfilTpInput,
} from "@/lib/perfiles-tp-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";

export const dynamic = "force-dynamic";

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await assertAccess();
  if ("response" in access) {
    return access.response;
  }

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Id invalido." }, { status: 400 });
  }

  const existing = await getPerfilTpRowById(id);
  if (!existing) {
    return NextResponse.json({ error: "No se encontro el perfil a editar." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as {
      row?: Partial<PerfilTpInput>;
    };

    const row = body.row ?? {};
    const sanitizedRow: Partial<PerfilTpInput> = {
      Empresa: row.Empresa?.trim() || undefined,
      Nombre: row.Nombre?.trim() || undefined,
      WhatsApp: row.WhatsApp?.trim() || undefined,
      Telefono: row.Telefono?.trim() || undefined,
      Web: row.Web?.trim() || undefined,
      Instagram: row.Instagram?.trim() || undefined,
      LinkedIn: row.LinkedIn?.trim() || undefined,
      Transferencia: row.Transferencia?.trim() || undefined,
      CodigoAleatorio: row.CodigoAleatorio?.trim() || undefined,
    };

    if (row.Logo !== undefined) {
      const logo = row.Logo?.trim() ?? "";
      if (logo && logo.length <= 4000) {
        sanitizedRow.Logo = logo;
      }
    }

    if (row.Contacto !== undefined) {
      const contacto = row.Contacto?.trim() ?? "";
      if (contacto && contacto.length <= 4000) {
        sanitizedRow.Contacto = contacto;
      }
    }

    await updatePerfilTpRowPartial(id, sanitizedRow);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible actualizar el perfil.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await assertAccess();
  if ("response" in access) {
    return access.response;
  }

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) {
    return NextResponse.json({ error: "Id invalido." }, { status: 400 });
  }

  const existing = await getPerfilTpRowById(id);
  if (!existing) {
    return NextResponse.json({ error: "No se encontro el perfil a eliminar." }, { status: 404 });
  }

  try {
    const deleted = await deletePerfilTpRow(id);
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible eliminar el perfil.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
