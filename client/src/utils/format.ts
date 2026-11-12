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

/** `['Lucía', 'Elena', 'Irene']` → «Lucía, Elena e Irene». */
export function formatList(items: string[]): string {
  return lista.format(items);
}
