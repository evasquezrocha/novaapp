# Plantilla de importacion Sistema OTN

Usa estos archivos como base para cargar datos en la siguiente secuencia:

1. `sistema-otn.csv`
2. `sistema-otn-aprobaciones.csv`
3. `sistema-otn-entregas-manuales.csv`

La relacion entre las tablas es la columna `OTN`.

## Reglas

- Usa `OTN` como identificador comun en los tres archivos.
- `FechaIngreso`, `FechaAprobacion` y `FechaEntrega` pueden ir en formato `DD-MM-YYYY`, `YYYY-MM-DD` o como serial de Excel.
- Los importes deben usar punto decimal, por ejemplo `1250000.50`.
- `EntregaFuente` acepta `sap` o `manual`.
- `Equipo` acepta `Si` o `No`.
- Las columnas opcionales pueden dejarse vacias.
- Si no llenas `Estado`, la aplicacion usa `Ingresado`.

## Archivos

### `sistema-otn.csv`

Columnas:

- `OTN`
- `Estado`
- `FechaIngreso`
- `Cliente`
- `Empresa`
- `EntregaFuente`
- `Solicitante`
- `CC`
- `Cantidad`
- `Descripcion`
- `ReferenciaCliente`
- `Cotizador`
- `Equipo`
- `FechaPpto`
- `ValorPpto`
- `Plazo`
- `Observaciones`
- `Ruta`

### `sistema-otn-aprobaciones.csv`

Columnas:

- `OTN`
- `FechaAprobacion`
- `ValorAprobado`
- `OC`
- `ReferenciaCliente`

### `sistema-otn-entregas-manuales.csv`

Columnas:

- `OTN`
- `FechaEntrega`
- `ValorEntrega`
- `ReferenciaEntrega`

## Importacion

Para cargar los datos usa:

```bash
npm run import:sistema-otn -- "C:\ruta\a\la\carpeta"
```

Tambien puedes pasar un `.xlsx` con hojas llamadas exactamente:

- `sistema-otn`
- `sistema-otn-aprobaciones`
- `sistema-otn-entregas-manuales`

Opciones utiles:

- `--dry-run` valida sin escribir en la base.
- `--append` conserva aprobaciones y entregas existentes para las OTN importadas. Sin esa bandera, el importador reemplaza los hijos de esas OTN.
