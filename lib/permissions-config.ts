export const ROLES = ["Administrador", "Supervisor", "Operador", "Usuario", "RRHH", "Gerencia"] as const;
export const MODULES = [
  "Producción",
  "Sistema OTN",
  "Bodega",
  "Usuarios",
  "Log",
  "Monitoreo",
  "Permisos",
  "Administración",
  "Asistencia",
] as const;
export const ACTIONS = ["Ver", "Crear", "Editar", "Eliminar"] as const;

export const MODULE_SECTIONS = [
  {
    title: "Producción",
    modules: ["Producción"],
    submodules: ["Disponible OTN", "Disponible CC"],
  },
  {
    title: "Sistema OTN",
    modules: ["Sistema OTN"],
    submodules: ["Sistema OTN", "Ficha OTN"],
  },
  {
    title: "Bodega",
    modules: ["Bodega"],
    submodules: ["Stock Actual", "Búsqueda en OC"],
  },
  {
    title: "Administración",
    modules: ["Administración"],
    submodules: ["Activos Fijos", "Perfiles TP"],
  },
  {
    title: "Configuración",
    modules: ["Usuarios", "Log", "Monitoreo", "Permisos"],
    submodules: ["Usuarios", "Log", "Monitoreo", "Importar Sistema OTN", "Permisos", "Roles"],
  },
  {
    title: "Asistencia",
    modules: ["Asistencia"],
    submodules: ["CT Supervisores"],
  },
] as const;
