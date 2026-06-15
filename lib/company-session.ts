import { type SapCompanyKey } from "@/lib/company-config";

export async function setActiveSapCompany(company: SapCompanyKey) {
  const response = await fetch("/api/configuracion/empresa", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ company }),
  });

  const payload = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "No fue posible cambiar la empresa.");
  }
}
