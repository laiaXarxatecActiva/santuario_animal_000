import { formatEuros } from '../../../utils/format.js';
import { htmlParrafos, type EmailContent } from './layout.js';

// CU-39 A2: aviso de una donación devuelta. Los emails de pagos se envían siempre (RN-19).
export function donationRefundedEmail(datos: {
  donorName: string | null;
  amount: string;
  reference: string;
  /** Hecha en la web: se devuelve por el mismo medio. Si no, a mano. */
  online: boolean;
}): EmailContent {
  const saludo = datos.donorName ? `Hola, ${datos.donorName}:` : 'Hola:';
  const cuerpo = `Te hemos devuelto tu donación de ${formatEuros(datos.amount)} (referencia ${datos.reference}).`;
  const medio = datos.online
    ? 'La devolución se hace por el mismo medio con el que pagaste.'
    : 'Como la hiciste en efectivo o por transferencia, nos pondremos en contacto contigo para devolvértela.';
  const gracias = 'Gracias de todos modos por pensar en los buitres del santuario.';
  return {
    subject: 'Te hemos devuelto tu donación',
    text: [saludo, '', cuerpo, '', medio, '', gracias, '', 'Santuario de Animales'].join('\n'),
    html: htmlParrafos([saludo, cuerpo, medio, gracias, 'Santuario de Animales']),
  };
}
