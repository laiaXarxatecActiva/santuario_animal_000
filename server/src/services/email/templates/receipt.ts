import type { Language } from '@sanctuary/shared';
import { formatEuros, formatFecha } from '../../../utils/format.js';

// Datos del recibo de una cuota, comunes a adoption-welcome y payment-completed.
export interface ReceiptData {
  firstName: string;
  animalName: string;
  planName: string;
  amount: string;
  periodStart: string;
  periodEnd: string;
  reference: string;
  /** Enlace a «Mis animales». */
  url: string;
  /** Idioma del destinatario (Fase 3); por defecto, castellano. */
  language?: Language;
}

export function lineasRecibo(datos: ReceiptData): string[] {
  const idioma = datos.language ?? 'es';
  const importe = formatEuros(datos.amount, idioma);
  const desde = formatFecha(datos.periodStart);
  const hasta = formatFecha(datos.periodEnd);
  const lineas = {
    es: [
      `Recibo: ${datos.animalName} · Plan ${datos.planName}`,
      `Importe: ${importe}`,
      `Periodo: del ${desde} al ${hasta}`,
      `Referencia: ${datos.reference}`,
    ],
    ca: [
      `Rebut: ${datos.animalName} · Pla ${datos.planName}`,
      `Import: ${importe}`,
      `Període: del ${desde} al ${hasta}`,
      `Referència: ${datos.reference}`,
    ],
    en: [
      `Receipt: ${datos.animalName} · ${datos.planName} plan`,
      `Amount: ${importe}`,
      `Period: ${desde} to ${hasta}`,
      `Reference: ${datos.reference}`,
    ],
  }[idioma];
  return lineas;
}
