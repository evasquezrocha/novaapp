"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SAP_COMPANY_OPTIONS,
  type SapCompanyKey,
} from "@/lib/company-config";

export function CompanySwitcher({
  currentCompanyKey,
}: {
  currentCompanyKey: SapCompanyKey;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function selectCompany(nextCompanyKey: SapCompanyKey) {
    if (nextCompanyKey === currentCompanyKey || pending) {
      return;
    }

    setError(null);

    try {
      const response = await fetch("/api/configuracion/empresa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ company: nextCompanyKey }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible cambiar la empresa.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (selectError) {
      setError(
        selectError instanceof Error
          ? selectError.message
          : "No fue posible cambiar la empresa.",
      );
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {SAP_COMPANY_OPTIONS.map((company) => {
          const selected = company.key === currentCompanyKey;

          return (
            <button
              key={company.key}
              type="button"
              onClick={() => void selectCompany(company.key)}
              disabled={pending}
              className={[
                "rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition",
                selected
                  ? "border-[#ffb347] bg-[#ff9200] text-white"
                  : "border-white/15 bg-white/8 text-white/85 hover:border-[#ffb347]/60 hover:bg-white/12",
                pending ? "cursor-not-allowed opacity-70" : "",
              ].join(" ")}
            >
              <span className="block text-[0.65rem] uppercase tracking-[0.25em] text-current/70">
                Empresa
              </span>
              <span className="mt-1 block text-sm font-semibold">
                {company.label}
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </p>
      ) : null}
    </div>
  );
}
