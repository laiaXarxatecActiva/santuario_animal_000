// CU-39 Gestionar donaciones: reglas del administrador. Sin dependencias externas.
// Devolver usa las mismas reglas que una cuota (`pagos-admin.ts`).

export type ProblemaFechaDonacion = 'INVALID_DATE' | 'DATE_IN_FUTURE';

/** A1: la fecha de una donación manual debe existir y no ser posterior a hoy (`YYYY-MM-DD`). */
export function comprobarFechaDonacion(fecha: string, hoy: string): ProblemaFechaDonacion | null {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  const enCalendario = new Date(Date.UTC(anio, mes - 1, dia));
  const existe =
    enCalendario.getUTCFullYear() === anio &&
    enCalendario.getUTCMonth() === mes - 1 &&
    enCalendario.getUTCDate() === dia;
  if (!existe) return 'INVALID_DATE';
  return fecha > hoy ? 'DATE_IN_FUTURE' : null;
}

/** Primer día del mes que está `n` meses antes que `mes` (`YYYY-MM`). */
function mesesAntes(mes: string, n: number): string {
  const [anio, numero] = mes.split('-').map(Number) as [number, number];
  const total = anio * 12 + (numero - 1) - n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}

/**
 * Paso 3, «Por meses»: los meses que abarcan «desde» y «hasta». Sin «hasta», hasta
 * el mes actual; sin «desde», los 12 meses que terminan en «hasta».
 * Devuelve el primer día del primer y del último mes.
 */
export function rangoMeses(filtros: { from?: string; to?: string }, hoy: string): { desde: string; hasta: string } {
  const hasta = `${(filtros.to ?? hoy).slice(0, 7)}-01`;
  const desde = filtros.from ? `${filtros.from.slice(0, 7)}-01` : mesesAntes(hasta.slice(0, 7), 11);
  return { desde, hasta };
}
