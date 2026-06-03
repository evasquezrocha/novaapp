import { NextResponse } from "next/server";
import {
  COMPANY_COOKIE_NAME,
  isSapCompanyKey,
} from "@/lib/company-config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { company?: unknown };
    const company = body.company;

    if (!isSapCompanyKey(company)) {
      return NextResponse.json(
        { error: "Empresa inválida." },
        { status: 400 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(COMPANY_COOKIE_NAME, company, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "No fue posible cambiar la empresa." },
      { status: 500 },
    );
  }
}
