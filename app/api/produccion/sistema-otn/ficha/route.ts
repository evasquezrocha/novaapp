import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { canAccess, listPermissions } from "@/lib/permissions-sql";
import { getSistemaOtnRowByOtn } from "@/lib/sistema-otn-sql";
import { getSistemaOtnAprobacionesRowsByOtn } from "@/lib/sistema-otn-aprobaciones-sql";
import { listSistemaOtnEntregasManualesRowsByOtn } from "@/lib/sistema-otn-entregas-manuales-sql";
import { resolveSapCompanyKeyFromEmpresa } from "@/lib/company-config";
import {
  getMaterialesUtilizadosByOtn,
  getSalesCreditNotesByOtn,
  getSalesInvoicesByOtn,
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
  if (!canAccess(permissions, session.Rol, "Sistema OTN")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const otn = url.searchParams.get("otn")?.trim() ?? "";

  if (!otn || !/^\d{4,6}$/.test(otn)) {
    return NextResponse.json(
      { error: "El OTN debe tener entre 4 y 6 dígitos numéricos." },
      { status: 400 },
    );
  }

  try {
    const info = await getSistemaOtnRowByOtn(otn);
    const companyKey = resolveSapCompanyKeyFromEmpresa(info?.Empresa);

    const [aprobaciones, materialesUtilizados, entregasManuales, facturas, notasCredito] =
      await Promise.all([
        getSistemaOtnAprobacionesRowsByOtn(otn),
        getMaterialesUtilizadosByOtn(otn, companyKey),
        listSistemaOtnEntregasManualesRowsByOtn(otn),
        getSalesInvoicesByOtn(otn, companyKey),
        getSalesCreditNotesByOtn(otn, companyKey),
      ]);

    return NextResponse.json({
      otn,
      info,
      aprobaciones,
      entregas: {
        materialesUtilizados,
        manuales: entregasManuales,
      },
      facturas,
      notasCredito,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible consultar la ficha OTN.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
