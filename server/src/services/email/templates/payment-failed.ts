import { formatEuros } from '../../../utils/format.js';
import { htmlConEnlace, type EmailContent } from './layout.js';

// CU-43 3a: cuota mensual fallida; la adopción queda pausada hasta regularizarla (CU-14).
export function paymentFailedEmail(datos: {
  firstName: string;
  animalName: string;
  amount: string;
  /** Ficha de la adopción en «Mis animales», donde se reintenta el pago. */
  url: string;
}): EmailContent {
  const saludo = `Hola, ${datos.firstName}:`;
  const cuerpo = `No hemos podido cobrar la cuota de ${formatEuros(datos.amount)} de tu adopción de ${datos.animalName}. La adopción queda pausada hasta que se regularice el pago.`;
  const accion = 'Puedes volver a intentarlo desde «Mis animales»:';
  const aviso = 'Pago simulado: no se ha realizado ningún cargo real.';
  return {
    subject: `No hemos podido cobrar la cuota de ${datos.animalName}`,
    text: [saludo, '', cuerpo, '', accion, datos.url, '', aviso, '', 'Santuario de Animales'].join('\n'),
    html: htmlConEnlace([saludo, cuerpo, accion], { url: datos.url, texto: 'Regularizar el pago' }, [aviso]),
  };
}
