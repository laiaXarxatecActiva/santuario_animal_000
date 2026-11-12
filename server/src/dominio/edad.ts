// Edad aproximada de un animal a partir de su fecha de nacimiento aproximada.
// Las fechas son strings `YYYY-MM-DD`; «hoy» lo aporta el Reloj.

function partes(fecha: string): { anio: number; mesDia: string } {
  return { anio: Number(fecha.slice(0, 4)), mesDia: fecha.slice(5) };
}

/** Años cumplidos en `hoy` por quien nació en `nacimiento`. */
export function edadEnAnios(nacimiento: string, hoy: string): number {
  const n = partes(nacimiento);
  const h = partes(hoy);
  const yaCumplidos = h.mesDia >= n.mesDia;
  return h.anio - n.anio - (yaCumplidos ? 0 : 1);
}

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

/** La misma fecha `anios` años antes (el 29 de febrero pasa a 28 si hace falta). */
export function restarAnios(fecha: string, anios: number): string {
  const { anio, mesDia } = partes(fecha);
  const nuevoAnio = anio - anios;
  const dia = mesDia === '02-29' && !esBisiesto(nuevoAnio) ? '02-28' : mesDia;
  return `${String(nuevoAnio).padStart(4, '0')}-${dia}`;
}

export interface LimitesNacimiento {
  /** Nacido en esta fecha o antes (edad mínima). */
  nacidoComoTarde?: string;
  /** Nacido estrictamente después de esta fecha (edad máxima). */
  nacidoDespuesDe?: string;
}

/** Convierte un rango de edades (en años cumplidos) en límites de fecha de nacimiento. */
export function limitesDeNacimiento(rango: { minAge?: number; maxAge?: number }, hoy: string): LimitesNacimiento {
  const limites: LimitesNacimiento = {};
  if (rango.minAge !== undefined) limites.nacidoComoTarde = restarAnios(hoy, rango.minAge);
  if (rango.maxAge !== undefined) limites.nacidoDespuesDe = restarAnios(hoy, rango.maxAge + 1);
  return limites;
}
