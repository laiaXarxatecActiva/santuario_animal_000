import type { Language } from '@sanctuary/shared';
import { fechaEnZonaSantuario } from '../../../dominio/reloj.js';
import { formatEuros, formatFecha } from '../../../utils/format.js';
import { htmlParrafos, type EmailContent } from './layout.js';
import { FIRMA, idiomaDe, PAGO_SIMULADO, saludo } from './textos.js';

// CU-05 paso 7: agradecimiento con el recibo de la donación.
export function donationThanksEmail(datos: {
  donorName: string | null;
  amount: string;
  paidAt: Date;
  reference: string;
  /** CU-39 A1: una donación registrada a mano no es un pago simulado. */
  simulated?: boolean;
  language?: Language;
}): EmailContent {
  const idioma = idiomaDe(datos);
  const importe = formatEuros(datos.amount, idioma);
  const fecha = formatFecha(fechaEnZonaSantuario(datos.paidAt));
  const t = {
    es: {
      subject: '¡Gracias por tu donación!',
      cuerpo: 'Muchas gracias por tu donación. Nos ayuda a cuidar de los buitres que viven en el santuario.',
      recibo: ['Recibo: Donación', `Importe: ${importe}`, `Fecha: ${fecha}`, `Referencia: ${datos.reference}`],
    },
    ca: {
      subject: 'Gràcies per la teua donació!',
      cuerpo: 'Moltes gràcies per la teua donació. Ens ajuda a cuidar els voltors que viuen al santuari.',
      recibo: ['Rebut: Donació', `Import: ${importe}`, `Data: ${fecha}`, `Referència: ${datos.reference}`],
    },
    en: {
      subject: 'Thank you for your donation!',
      cuerpo: 'Thank you very much for your donation. It helps us care for the vultures that live at the sanctuary.',
      recibo: ['Receipt: Donation', `Amount: ${importe}`, `Date: ${fecha}`, `Reference: ${datos.reference}`],
    },
  }[idioma];
  const hola = saludo(idioma, datos.donorName);
  const recibo = [...t.recibo, ...(datos.simulated === false ? [] : [PAGO_SIMULADO[idioma]])];
  return {
    subject: t.subject,
    text: [hola, '', t.cuerpo, '', ...recibo, '', FIRMA].join('\n'),
    html: htmlParrafos([hola, t.cuerpo, ...recibo, FIRMA], idioma),
  };
}
