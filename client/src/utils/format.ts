// Formatos de presentación (TECH_SPEC §12.2, DESIGN_SYSTEM §10). Solo dan
// formato: los importes llegan como string y nunca se suman en el cliente.

const ZONA_SANTUARIO = 'Europe/Madrid';

const moneda = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const decimal = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
const fechaLarga = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: ZONA_SANTUARIO,
});
// Los DATE (`YYYY-MM-DD`) se formatean en UTC para que el día no cambie.
const fechaDia = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fechaCortaDia = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const fechaCortaInstante = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: ZONA_SANTUARIO,
});
const mesCorto = new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const monedaEje = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const entero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const mesAnio = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
// `en-CA` escribe las fechas como `YYYY-MM-DD`.
const diaIso = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: ZONA_SANTUARIO,
});
const lista = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });

/** `'5.00'` → `'5,00 €'`. */
export function formatCurrency(amount: string): string {
  return moneda.format(Number(amount));
}

/** `'8.40'` → `'8,4'` (pesos y otras cifras con decimales; solo para mostrar). */
export function formatDecimal(value: string): string {
  return decimal.format(Number(value));
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

/** `'2026-11-05'` → «5 nov 2026» (tablas y recibos). */
export function formatShortDate(date: string): string {
  return fechaCortaDia.format(new Date(`${date}T00:00:00Z`));
}

/** Instante ISO → «5 nov 2026» en la zona del santuario. */
export function formatShortInstant(isoInstant: string): string {
  return fechaCortaInstante.format(new Date(isoInstant));
}

/**
 * Día anterior a una fecha `YYYY-MM-DD`. Solo para mostrar: el último día pagado
 * antes de una cuota (CU-21 paso 2); la fecha que cuenta la fija el servidor.
 */
export function previousDay(date: string): string {
  const dia = new Date(`${date}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() - 1);
  return dia.toISOString().slice(0, 10);
}

/** `'2026-11'` → «noviembre de 2026» (CU-39, total por mes). */
export function formatMonth(month: string): string {
  return mesAnio.format(new Date(`${month}-01T00:00:00Z`));
}

/** `'2026-11'` → «nov 26» (ejes de los gráficos, CU-41). */
export function formatShortMonth(month: string): string {
  return mesCorto.format(new Date(`${month}-01T00:00:00Z`));
}

/** Marca del eje de un gráfico de importes: `250` → «250 €». */
export function formatCurrencyAxis(value: number): string {
  return monedaEje.format(value);
}

/** Cantidades enteras: `1200` → «1200». */
export function formatNumber(value: number): string {
  return entero.format(value);
}

/**
 * Hoy en la zona del santuario (`YYYY-MM-DD`). Solo como valor propuesto en un
 * formulario (CU-39 A1); la fecha válida la decide el servidor.
 */
export function todayInSanctuary(ahora: Date = new Date()): string {
  return diaIso.format(ahora);
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
