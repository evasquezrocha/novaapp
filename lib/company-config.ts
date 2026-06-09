export const COMPANY_COOKIE_NAME = "nova_company";

export const SAP_COMPANIES = {
  chile: {
    key: "chile",
    label: "Novamine Chile",
    databaseEnvKey: "SQL_DATABASE_SAP",
  },
  novamine: {
    key: "novamine",
    label: "Novamine",
    databaseEnvKey: "SQL_DATABASE_SAP2",
  },
} as const;

export type SapCompanyKey = keyof typeof SAP_COMPANIES;
export type SapCompanyConfig = (typeof SAP_COMPANIES)[SapCompanyKey];

export const SAP_COMPANY_OPTIONS = [SAP_COMPANIES.chile, SAP_COMPANIES.novamine];

export function isSapCompanyKey(value: unknown): value is SapCompanyKey {
  return value === "chile" || value === "novamine";
}

export function resolveSapCompanyKeyFromEmpresa(value: string | null | undefined): SapCompanyKey {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "novamine chile") {
    return "chile";
  }

  if (normalized === "novamine") {
    return "novamine";
  }

  const fallbackValue = process.env.APP_COMPANY?.trim().toLowerCase();
  return fallbackValue === "novamine" ? "novamine" : "chile";
}
