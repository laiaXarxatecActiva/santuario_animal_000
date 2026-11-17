import type { EmailFrequency } from '@sanctuary/shared';

// Avisos a los adoptantes (CU-31, CU-46) y preferencias de email (RN-19).

export interface PreferenciasEmail {
  emailNotifications: boolean;
  emailFrequency: EmailFrequency;
}

/** CU-31 4.2: email por cada actualización. */
export function recibeEmailPorActualizacion(p: PreferenciasEmail): boolean {
  return p.emailNotifications && p.emailFrequency === 'per_update';
}

/** CU-46: resumen mensual en lugar de un email por actualización. */
export function recibeResumenMensual(p: PreferenciasEmail): boolean {
  return p.emailNotifications && p.emailFrequency === 'monthly_digest';
}

const dosCifras = (n: number) => String(n).padStart(2, '0');

/** CU-46 paso 1: primer y último día del mes anterior a `hoy` (`YYYY-MM-DD`). */
export function mesAnterior(hoy: string): { desde: string; hasta: string } {
  const [y = 0, m = 1] = hoy.split('-').map(Number);
  const anio = m === 1 ? y - 1 : y;
  const mes = m === 1 ? 12 : m - 1;
  // Día 0 del mes siguiente = último día del mes.
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return { desde: `${anio}-${dosCifras(mes)}-01`, hasta: `${anio}-${dosCifras(mes)}-${dosCifras(ultimo)}` };
}

/** CU-46 paso 2: texto en una línea, cortado por una palabra si pasa de `max` caracteres. */
export function extracto(texto: string, max: number): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > 0 ? corte.slice(0, espacio) : corte).replace(/[\s,.;:]+$/, '')}…`;
}
