// Formato en castellano para los textos que genera el servidor (emails).

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

/** "5.00" → "5,00 €". El importe ya viene calculado; aquí solo se muestra. */
export function formatEuros(importe: string): string {
  return euros.format(Number(importe));
}

/** "2026-01-05" → "05/01/2026", sin crear un Date (evita líos de zona horaria). */
export function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}
