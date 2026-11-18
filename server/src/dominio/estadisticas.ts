import { rangoMeses } from './donaciones-admin.js';

// CU-41: reglas del rango de las estadísticas.

/** Más meses harían el gráfico ilegible y la consulta innecesariamente grande. */
export const MAX_MESES_ESTADISTICAS = 60;
export const MENSAJE_RANGO_LARGO = `El rango no puede superar los ${MAX_MESES_ESTADISTICAS} meses.`;

export interface RangoMeses {
  /** Primer día del primer mes (`YYYY-MM-01`). */
  desde: string;
  /** Primer día del último mes. */
  hasta: string;
}

/** Paso 2: por defecto, los últimos 12 meses (incluido el actual); igual que «Por meses» de CU-39. */
export function rangoEstadisticas(filtros: { from?: string; to?: string }, hoy: string): RangoMeses {
  return rangoMeses(filtros, hoy);
}

/** Meses del rango, ambos incluidos. */
export function mesesDelRango({ desde, hasta }: RangoMeses): number {
  const indice = (dia: string) => Number(dia.slice(0, 4)) * 12 + Number(dia.slice(5, 7));
  return indice(hasta) - indice(desde) + 1;
}
