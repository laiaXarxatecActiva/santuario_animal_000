import type { ReceiptDto } from '@sanctuary/shared';
import { ZONA_HORARIA_SANTUARIO } from './reloj.js';

// Textos del certificado (CU-22) y del recibo (CU-19) en PDF. Aquí solo se
// decide qué se dice; el servicio de PDF decide cómo se dibuja.

export const NOMBRE_SANTUARIO = 'Santuario de Animales';
export const NOTA_ACADEMICA = 'Proyecto académico: el santuario y sus datos son ficticios.';

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const diaLargo = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const diaCorto = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const instanteLargo = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: ZONA_HORARIA_SANTUARIO,
});

/** `YYYY-MM-DD` → «5 de septiembre de 2025». */
const fechaLarga = (dia: string) => diaLargo.format(new Date(`${dia}T00:00:00Z`));
/** `YYYY-MM-DD` → «5 nov 2026». */
const fechaCorta = (dia: string) => diaCorto.format(new Date(`${dia}T00:00:00Z`));
/** Instante ISO → día en el santuario, «5 de noviembre de 2026». */
const instante = (iso: string) => instanteLargo.format(new Date(iso));

export interface DatosCertificado {
  adopterName: string;
  animalName: string;
  speciesName: string;
  /** `YYYY-MM-DD`. */
  startDate: string;
}

export interface ContenidoCertificado {
  titulo: string;
  /** Líneas centradas; las pares (0, 2, 4…) son el texto de enlace y las impares, los datos. */
  lineas: string[];
  nota: string;
}

/** CU-22 paso 2. */
export function contenidoCertificado(d: DatosCertificado): ContenidoCertificado {
  return {
    titulo: 'Certificado de adopción',
    lineas: [
      `${NOMBRE_SANTUARIO} certifica que`,
      d.adopterName,
      'apadrina simbólicamente a',
      d.animalName,
      d.speciesName,
      `desde el ${fechaLarga(d.startDate)}`,
    ],
    nota: 'La adopción es simbólica: el animal sigue viviendo en el santuario. Gracias por ayudarnos a cuidarlo.',
  };
}

export interface ContenidoRecibo {
  titulo: string;
  filas: [string, string][];
  /** «Pago simulado» (solo con la pasarela simulada). */
  aviso: string | null;
}

const FORMAS_DE_PAGO: Record<ReceiptDto['method'], string> = {
  simulated: 'Pago simulado',
  cash: 'Efectivo',
  bank_transfer: 'Transferencia',
  card: 'Tarjeta',
};

function concepto(r: ReceiptDto): string {
  if (r.kind === 'donation' || !r.animalName) return 'Donación';
  const partes = [`Cuota de ${r.animalName}`];
  if (r.planName) partes.push(`Plan ${r.planName}`);
  if (r.periodStart && r.periodEnd) partes.push(`del ${fechaCorta(r.periodStart)} al ${fechaCorta(r.periodEnd)}`);
  return partes.join(' · ');
}

/** CU-19 paso 5 y 4b. */
export function contenidoRecibo(r: ReceiptDto): ContenidoRecibo {
  return {
    titulo: 'Recibo',
    filas: [
      ['Pagado por', `${r.payer.fullName}\n${r.payer.email}`],
      ['Concepto', concepto(r)],
      ['Importe', euros.format(Number(r.amount))],
      ['Fecha del pago', instante(r.paidAt)],
      ['Forma de pago', FORMAS_DE_PAGO[r.method]],
      ['Referencia', r.reference],
      ['Estado', r.refundedAt ? `Devuelto el ${instante(r.refundedAt)}` : 'Cobrado'],
    ],
    aviso: r.method === 'simulated' ? 'Pago simulado: no se ha realizado ningún cargo real.' : null,
  };
}

/** «certificado-ebano.pdf»: sin tildes, espacios ni signos, para cualquier sistema. */
export function nombreArchivo(prefijo: string, nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return limpio ? `${prefijo}-${limpio}.pdf` : `${prefijo}.pdf`;
}
