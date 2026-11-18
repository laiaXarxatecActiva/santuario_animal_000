import { formatEuros, formatFecha } from '../../../utils/format.js';
import { htmlConEnlace, type EmailContent } from './layout.js';

// CU-38 A1: aviso de una cuota devuelta. Los emails de pagos se envían siempre (RN-19).
export function paymentRefundedEmail(datos: {
  firstName: string;
  animalName: string;
  amount: string;
  periodStart: string;
  periodEnd: string;
  /** Pago hecho en la web: se devuelve por el mismo medio. Si no, a mano. */
  online: boolean;
  url: string;
}): EmailContent {
  const saludo = `Hola, ${datos.firstName}:`;
  const cuerpo = `Te hemos devuelto ${formatEuros(datos.amount)} de la cuota de ${datos.animalName} del ${formatFecha(datos.periodStart)} al ${formatFecha(datos.periodEnd)}.`;
  const medio = datos.online
    ? 'La devolución se hace por el mismo medio con el que pagaste.'
    : 'Como la pagaste en efectivo o por transferencia, nos pondremos en contacto contigo para devolvértela.';
  return {
    subject: `Te hemos devuelto una cuota de ${datos.animalName}`,
    text: [saludo, '', cuerpo, '', medio, '', datos.url, '', 'Santuario de Animales'].join('\n'),
    html: htmlConEnlace([saludo, cuerpo, medio], { url: datos.url, texto: 'Ver mis aportaciones' }),
  };
}
