import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { getSistemaOtnRowByOtn } from "@/lib/sistema-otn-sql";
import { getSistemaOtnAprobacionesRowsByOtn } from "@/lib/sistema-otn-aprobaciones-sql";
import { listSistemaOtnEntregasManualesRowsByOtn } from "@/lib/sistema-otn-entregas-manuales-sql";
import { createServerTimingContext } from "@/lib/server-performance";
import { resolveSapCompanyKeyFromEmpresa } from "@/lib/company-config";
import {
  getSalesCreditNotesByOtn,
  getSalesInvoicesByOtn,
} from "@/lib/sap-stock";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const timing = createServerTimingContext("GET /api/produccion/sistema-otn/ficha");
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await timing.measure("session", () => getSessionUserByToken(token)) : null;

  if (!session) {
    const response = NextResponse.json({ error: "No autorizado." }, { status: 401 });
    timing.finalize();
    timing.apply(response);
    return response;
  }

  const permissions = await timing.measure("permissions", () => listPermissions());
  if (!canAccess(permissions, session.Rol, "Sistema OTN")) {
    const response = NextResponse.json({ error: "No autorizado." }, { status: 403 });
    timing.finalize();
    timing.apply(response);
    return response;
  }

  const url = new URL(request.url);
  const otn = url.searchParams.get("otn")?.trim() ?? "";

  if (!otn || !/^\d{4,6}$/.test(otn)) {
    const response = NextResponse.json(
      { error: "El OTN debe tener entre 4 y 6 dígitos numéricos." },
      { status: 400 },
    );
    timing.finalize();
    timing.apply(response);
    return response;
  }

  try {
    const info = await timing.measure("info", () => getSistemaOtnRowByOtn(otn));
    const companyKey = resolveSapCompanyKeyFromEmpresa(info?.Empresa);

    const [aprobaciones, entregasManuales, facturas, notasCredito] = await timing.measure(
      "related",
      () =>
        Promise.all([
          getSistemaOtnAprobacionesRowsByOtn(otn),
          listSistemaOtnEntregasManualesRowsByOtn(otn),
          getSalesInvoicesByOtn(otn, companyKey),
          getSalesCreditNotesByOtn(otn, companyKey),
        ]),
    );

    const response = NextResponse.json({
      otn,
      info,
      aprobaciones,
      entregas: {
        manuales: entregasManuales,
      },
      facturas,
      notasCredito,
    });
    timing.finalize();
    timing.apply(response);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible consultar la ficha OTN.";
    const response = NextResponse.json({ error: message }, { status: 500 });
    timing.finalize();
    timing.apply(response);
    return response;
  }
}
