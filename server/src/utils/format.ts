import type { Language } from '@sanctuary/shared';

// Formato de los textos que genera el servidor (emails y PDF), en el idioma
// del destinatario (Fase 3). Por defecto, castellano.

/** Configuración regional de cada idioma (el inglés, con el formato europeo de fechas). */
export const LOCALES: Record<Language, string> = { es: 'es-ES', ca: 'ca-ES', en: 'en-GB' };

const euros = Object.fromEntries(
  Object.entries(LOCALES).map(([idioma, locale]) => [
    idioma,
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }),
  ]),
) as Record<Language, Intl.NumberFormat>;

/** "5.00" → "5,00 €" (en inglés, "€5.00"). El importe ya viene calculado; aquí solo se muestra. */
export function formatEuros(importe: string, idioma: Language = 'es'): string {
  return euros[idioma].format(Number(importe));
}

/** "2026-01-05" → "05/01/2026", sin crear un Date (evita líos de zona horaria). Igual en los tres idiomas. */
export function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}
