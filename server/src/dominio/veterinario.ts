// CU-34: reglas del historial veterinario. Sin dependencias externas.

export type ProblemaFechaRegistro = 'INVALID_DATE' | 'DATE_IN_FUTURE';

/** 4a: la fecha tiene que existir en el calendario y no puede ser futura. */
export function comprobarFechaRegistro(fecha: string, hoy: string): ProblemaFechaRegistro | null {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  const enCalendario = new Date(Date.UTC(anio, mes - 1, dia));
  const existe =
    enCalendario.getUTCFullYear() === anio &&
    enCalendario.getUTCMonth() === mes - 1 &&
    enCalendario.getUTCDate() === dia;
  if (!existe) return 'INVALID_DATE';
  return fecha > hoy ? 'DATE_IN_FUTURE' : null;
}

export const MENSAJE_FECHA_REGISTRO: Record<ProblemaFechaRegistro, string> = {
  INVALID_DATE: 'La fecha no es válida.',
  DATE_IN_FUTURE: 'La fecha no puede ser futura.',
};
