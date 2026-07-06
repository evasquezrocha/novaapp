import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { getEquivalentStockRowsByCode } from "@/lib/sap-stock";
import { unstable_cache } from "next/cache";
import { PLATFORM_CACHE_TAGS, SAP_QUERY_CACHE_REVALIDATE_SECONDS } from "@/lib/platform-cache";

export const dynamic = "force-dynamic";

const getStockEquivalentesCached = unstable_cache(
  async (codigo: string) => getEquivalentStockRowsByCode(codigo),
  ["platform", "api", "bodega", "equivalentes"],
  {
    tags: [PLATFORM_CACHE_TAGS.bodega],
    revalidate: SAP_QUERY_CACHE_REVALIDATE_SECONDS,
  },
);

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
  const codigo = searchParams.get("codigo")?.trim() ?? "";

  if (!codigo) {
    return NextResponse.json(
      { error: "Debe indicar un codigo para consultar equivalencias." },
      { status: 400 },
    );
  }

  try {
    const rows = await getStockEquivalentesCached(codigo);
    return NextResponse.json({ rows });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible consultar las equivalencias.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
