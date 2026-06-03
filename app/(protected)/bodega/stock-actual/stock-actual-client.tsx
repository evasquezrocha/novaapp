"use client";

import { useEffect, useState } from "react";
import type { StockActualRow } from "@/lib/sap-stock";
import { StockActualTable } from "./stock-table";

function LoadingState() {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="animate-pulse space-y-4">
        <div className="h-5 w-48 rounded bg-slate-200" />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-10 rounded-xl bg-slate-100" />
          <div className="h-10 rounded-xl bg-slate-100" />
        </div>
        <div className="space-y-3">
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-12 rounded-xl bg-slate-100" />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-500">
        Cargando stock actual desde SAP...
      </p>
    </div>
  );
}

export function StockActualClient() {
  const [rows, setRows] = useState<StockActualRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRows() {
      try {
        setError(null);
        setRows(null);

        const response = await fetch("/api/bodega/stock-actual", {
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json()) as {
          rows?: StockActualRow[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            payload.error ??
              `No fue posible consultar el stock actual (${response.status}).`,
          );
        }

        if (payload.error) {
          throw new Error(payload.error);
        }

        setRows(payload.rows ?? []);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "No fue posible consultar el stock actual.",
        );
      }
    }

    void loadRows();

    return () => {
      controller.abort();
    };
  }, []);

  if (error) {
    return (
      <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (rows === null) {
    return <LoadingState />;
  }

  return <StockActualTable rows={rows} />;
}
