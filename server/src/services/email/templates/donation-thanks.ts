import { fechaEnZonaSantuario } from '../../../dominio/reloj.js';
import { formatEuros, formatFecha } from '../../../utils/format.js';
import { htmlParrafos, type EmailContent } from './layout.js';

// CU-05 paso 7: agradecimiento con el recibo de la donación.
export function donationThanksEmail(datos: {
  donorName: string | null;
  amount: string;
  paidAt: Date;
  reference: string;
}): EmailContent {
  const saludo = datos.donorName ? `Hola, ${datos.donorName}:` : 'Hola:';
  const cuerpo = 'Muchas gracias por tu donación. Nos ayuda a cuidar de los buitres que viven en el santuario.';
  const recibo = [
    'Recibo: Donación',
    `Importe: ${formatEuros(datos.amount)}`,
    `Fecha: ${formatFecha(fechaEnZonaSantuario(datos.paidAt))}`,
    `Referencia: ${datos.reference}`,
    'Pago simulado: no se ha realizado ningún cargo real.',
  ];
  return {
    subject: '¡Gracias por tu donación!',
    text: [saludo, '', cuerpo, '', ...recibo, '', 'Santuario de Animales'].join('\n'),
    html: htmlParrafos([saludo, cuerpo, ...recibo, 'Santuario de Animales']),
  };
}
