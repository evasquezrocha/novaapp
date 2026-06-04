import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import {
  getCentroCostoByCc,
  getMaterialesDevueltosByCc,
  getMaterialesUtilizadosByCc,
  getNcServiciosByCc,
  getServiciosSinOcByCc,
  getServiciosUtilizadosByCc,
} from "@/lib/sap-stock";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await getSessionUserByToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const permissions = await listPermissions();
  if (!canAccess(permissions, session.Rol, "Producción")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const cc = searchParams.get("cc")?.trim() ?? "";

  if (!/^\d{4}$/.test(cc)) {
    return NextResponse.json(
      { error: "El Centro de Costos debe tener 4 dígitos numéricos." },
      { status: 400 },
    );
  }

  try {
    const [
      centroCosto,
      materialesUtilizados,
      materialesDevueltos,
      serviciosSinOc,
      serviciosUtilizados,
      ncServicios,
    ] = await Promise.all([
      getCentroCostoByCc(cc),
      getMaterialesUtilizadosByCc(cc),
      getMaterialesDevueltosByCc(cc),
      getServiciosSinOcByCc(cc),
      getServiciosUtilizadosByCc(cc),
      getNcServiciosByCc(cc),
    ]);

    return NextResponse.json({
      centroCosto,
      materialesUtilizados,
      materialesDevueltos,
      serviciosSinOc,
      serviciosUtilizados,
      ncServicios,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible consultar el centro de costos.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
