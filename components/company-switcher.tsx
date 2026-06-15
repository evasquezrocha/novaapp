"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  SAP_COMPANY_OPTIONS,
  isSapCompanyKey,
  resolveSapCompanyKeyFromEmpresa,
  type SapCompanyKey,
} from "@/lib/company-config";
import { setActiveSapCompany } from "@/lib/company-session";

export function CompanySwitcher({
  currentCompanyKey,
}: {
  currentCompanyKey: SapCompanyKey;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const companyParam = searchParams.get("company")?.trim();
  const empresaParam = searchParams.get("empresa")?.trim();
  const routeCompanyKey = companyParam
    ? isSapCompanyKey(companyParam)
      ? companyParam
      : resolveSapCompanyKeyFromEmpresa(companyParam)
    : empresaParam
      ? resolveSapCompanyKeyFromEmpresa(empresaParam)
      : null;
  const activeCompanyKey = routeCompanyKey ?? currentCompanyKey;

  async function selectCompany(nextCompanyKey: SapCompanyKey) {
    if (nextCompanyKey === activeCompanyKey || pending) {
      return;
    }

    setError(null);

    try {
      await setActiveSapCompany(nextCompanyKey);

      startTransition(() => {
        if (routeCompanyKey) {
          const nextParams = new URLSearchParams(searchParams.toString());
          nextParams.set("company", nextCompanyKey);
          nextParams.delete("empresa");

          const nextQuery = nextParams.toString();
          router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
        }

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
          const selected = company.key === activeCompanyKey;

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
