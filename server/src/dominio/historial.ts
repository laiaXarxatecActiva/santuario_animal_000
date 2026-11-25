import type { Reloj } from './reloj.js';

// CU-15: el historial de «Mis animales» solo enseña el último año, para que no
// crezca sin fin. Lo anterior (los pagos) sigue en «Mis aportaciones».

/** Primer día que se muestra: el mismo día del año pasado (el 29 de febrero, desde el 28). */
export function inicioDelHistorial(reloj: Reloj): string {
  const [anio, mes, dia] = reloj.hoy().split('-').map(Number) as [number, number, number];
  const diasDelMes = new Date(Date.UTC(anio - 1, mes, 0)).getUTCDate();
  const d = Math.min(dia, diasDelMes);
  return `${anio - 1}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
