export type SistemaOtnEstadoTotals = {
  totalPresupuesto: number;
  totalAprobado: number;
  totalEntregado: number;
  totalFacturado: number;
  totalNotasCredito: number;
  totalFacturadoPendiente: number;
};

function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isZero(value: number) {
  return roundToTwo(value) === 0;
}

export function getSistemaOtnEstado(params: SistemaOtnEstadoTotals) {
  const saldoFacturado = roundToTwo(
    params.totalPresupuesto - params.totalFacturado + params.totalNotasCredito,
  );

  if (isZero(params.totalFacturadoPendiente) && isZero(saldoFacturado)) {
    return "Pagado";
  }

  if (isZero(saldoFacturado)) {
    return "Facturado";
  }

  if (isZero(roundToTwo(params.totalPresupuesto - params.totalEntregado))) {
    return "Entregado";
  }

  if (isZero(roundToTwo(params.totalPresupuesto - params.totalAprobado))) {
    return "Aprobado";
  }

  return "Ingresado";
}
