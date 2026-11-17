// Formatos de presentación (TECH_SPEC §12.2, DESIGN_SYSTEM §10). Solo dan
// formato: los importes llegan como string y nunca se suman en el cliente.

const ZONA_SANTUARIO = 'Europe/Madrid';

const moneda = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const fechaLarga = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: ZONA_SANTUARIO,
});
// Los DATE (`YYYY-MM-DD`) se formatean en UTC para que el día no cambie.
const fechaDia = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const lista = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });

/** `'5.00'` → `'5,00 €'`. */
export function formatCurrency(amount: string): string {
  return moneda.format(Number(amount));
}

/** Año de una fecha `YYYY-MM-DD`, sin convertirla a Date (evita saltos de zona horaria). */
export function formatYear(date: string): string {
  return date.slice(0, 4);
}

/** Instante ISO → «13 de octubre de 2026» en la zona del santuario. */
export function formatLongDate(isoInstant: string): string {
  return fechaLarga.format(new Date(isoInstant));
}

/** `'2026-11-29'` → «29 de noviembre de 2026». */
export function formatDate(date: string): string {
  return fechaDia.format(new Date(`${date}T00:00:00Z`));
}

/** `['Lucía', 'Elena', 'Irene']` → «Lucía, Elena e Irene». */
export function formatList(items: string[]): string {
  return lista.format(items);
}

// «hace 2 días» y no «anteayer» (SCREENS §4.7); solo el instante actual es «ahora».
const relativa = new Intl.RelativeTimeFormat('es', { numeric: 'always' });
const ahoraMismo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' }).format(0, 'second');
const UNIDADES: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** Instante ISO → «hace 2 días», «hace 3 horas», «ahora» (campana, CU-18). */
export function formatRelative(isoInstant: string, ahora: Date = new Date()): string {
  const segundos = Math.round((new Date(isoInstant).getTime() - ahora.getTime()) / 1000);
  for (const [unidad, duracion] of UNIDADES) {
    if (Math.abs(segundos) >= duracion) return relativa.format(Math.trunc(segundos / duracion), unidad);
  }
  return ahoraMismo;
}
