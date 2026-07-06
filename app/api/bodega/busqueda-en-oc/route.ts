import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import {
  searchPurchaseOrderRows,
  type PurchaseOrderSearchMode,
} from "@/lib/sap-stock";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { unstable_cache } from "next/cache";
import { PLATFORM_CACHE_TAGS, SAP_QUERY_CACHE_REVALIDATE_SECONDS } from "@/lib/platform-cache";

export const dynamic = "force-dynamic";

const getBusquedaEnOcCached = unstable_cache(
  async (mode: PurchaseOrderSearchMode, q: string) => {
    return searchPurchaseOrderRows({ mode, query: q });
  },
  ["platform", "api", "bodega", "busqueda-en-oc"],
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
  if (!canAccess(permissions, session.Rol, "Búsqueda en OC")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const q = searchParams.get("q")?.trim() ?? "";

  if (mode !== "proveedor" && mode !== "descripcion" && mode !== "codigo") {
    return NextResponse.json(
      { error: "Debes indicar un criterio de búsqueda válido." },
      { status: 400 },
    );
  }

  try {
    const rows = await getBusquedaEnOcCached(mode as PurchaseOrderSearchMode, q);
    return NextResponse.json({ rows });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible consultar las órdenes de compra.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
