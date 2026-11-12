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
}

export function lineasRecibo(datos: ReceiptData): string[] {
  return [
    `Recibo: ${datos.animalName} · Plan ${datos.planName}`,
    `Importe: ${formatEuros(datos.amount)}`,
    `Periodo: del ${formatFecha(datos.periodStart)} al ${formatFecha(datos.periodEnd)}`,
    `Referencia: ${datos.reference}`,
    'Pago simulado: no se ha realizado ningún cargo real.',
  ];
}
