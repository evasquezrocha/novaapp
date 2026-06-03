import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import {
  getAsientosDirectosByOtn,
  getMaterialesDevueltosByOtn,
  getMaterialesUtilizadosByOtn,
  getFondosRendidosByOtn,
  getProjectBudgetByOtn,
  getNcServiciosByOtn,
  getServiciosSinOcByOtn,
  getServiciosUtilizadosByOtn,
} from "@/lib/sap-stock";
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
  if (!canAccess(permissions, session.Rol, "Producción")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const otn = searchParams.get("otn");

  if (!otn || !/^\d{4,6}$/.test(otn)) {
    return NextResponse.json(
      { error: "El OTN debe tener entre 4 y 6 dígitos numéricos." },
      { status: 400 },
    );
  }

  try {
    const [
      row,
      materiales,
      materialesDevueltos,
      serviciosSinOc,
      serviciosUtilizados,
      ncServicios,
      asientosDirectos,
      fondosRendidos,
    ] = await Promise.all([
      getProjectBudgetByOtn(otn),
      getMaterialesUtilizadosByOtn(otn),
      getMaterialesDevueltosByOtn(otn),
      getServiciosSinOcByOtn(otn),
      getServiciosUtilizadosByOtn(otn),
      getNcServiciosByOtn(otn),
      getAsientosDirectosByOtn(otn),
      getFondosRendidosByOtn(otn),
    ]);

    if (!row) {
      return NextResponse.json(
        { error: "No se encontró el proyecto en SAP." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      row,
      materiales,
      materialesDevueltos,
      serviciosSinOc,
      serviciosUtilizados,
      ncServicios,
      asientosDirectos,
      fondosRendidos,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible consultar el proyecto en SAP.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
