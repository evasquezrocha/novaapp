import { NextResponse } from "next/server";
import { getAuthPool } from "@/lib/auth-sql";
import { listPermissions } from "@/lib/permissions-sql";
import { createServerTimingContext } from "@/lib/server-performance";

export const dynamic = "force-dynamic";

export async function GET() {
  const timing = createServerTimingContext("/api/warmup");

  try {
    await Promise.all([
      timing.measure("authPool", () => getAuthPool()),
      timing.measure("permissions", () => listPermissions()),
    ]);

    timing.finalize();

    const response = NextResponse.json({ ok: true });
    timing.apply(response);
    return response;
  } catch (error) {
    timing.finalize();

    const response = NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No fue posible completar el warmup.",
      },
      { status: 500 },
    );

    timing.apply(response);
    return response;
  }
}
