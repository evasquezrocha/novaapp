export const PLATFORM_CACHE_TAGS = {
  permissions: "permissions",
  roles: "roles",
  usuarios: "usuarios",
  sessions: "sessions",
  activosFijos: "activos-fijos",
  sistemaOtn: "sistema-otn",
  bodega: "bodega",
  perfilesTp: "perfiles-tp",
  ctSupervisores: "ct-supervisores",
} as const;

export const DEFAULT_CACHE_REVALIDATE_SECONDS = 300;
export const SAP_QUERY_CACHE_REVALIDATE_SECONDS = 120;
