import { DIAS_ENTRE_ACTUALIZACIONES } from './adopcion.js';

export type NivelAlerta = 'warning' | 'error';

/** RN-14: el aviso en amarillo empieza dos días antes del plazo. */
export const DIAS_AVISO_ACTUALIZACION = DIAS_ENTRE_ACTUALIZACIONES - 2;

const DIA_MS = 24 * 60 * 60 * 1000;

function enUtc(fecha: string): number {
  const [y = 0, m = 1, d = 1] = fecha.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Días naturales entre dos fechas `YYYY-MM-DD` (positivo si `hasta` es posterior). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((enUtc(hasta) - enUtc(desde)) / DIA_MS);
}

/** CU-27 y RN-14: amarillo con 12 o 13 días sin actualización; rojo desde 14. */
export function nivelAlertaActualizacion(diasSinActualizar: number): NivelAlerta | null {
  if (diasSinActualizar >= DIAS_ENTRE_ACTUALIZACIONES) return 'error';
  if (diasSinActualizar >= DIAS_AVISO_ACTUALIZACION) return 'warning';
  return null;
}
