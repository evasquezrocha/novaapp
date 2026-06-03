import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { getOpenPurchaseOrdersByItemCode } from "@/lib/sap-stock";
import { canAccess, listPermissions } from "@/lib/permissions-sql";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Bodega")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const codigo = searchParams.get("codigo");

  if (!codigo) {
    return NextResponse.json(
      { error: "Falta el código del artículo." },
      { status: 400 },
    );
  }

  try {
    const rows = await getOpenPurchaseOrdersByItemCode(codigo);
    return NextResponse.json({ rows });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible consultar los pedidos abiertos.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
