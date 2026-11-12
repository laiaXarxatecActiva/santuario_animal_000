import { htmlConEnlace, type EmailContent } from './layout.js';
import { lineasRecibo, type ReceiptData } from './receipt.js';

// Cuota cobrada (CU-14 con una adopción pausada; también la usará el cobro mensual, CU-43).
export function paymentCompletedEmail(datos: ReceiptData): EmailContent {
  const saludo = `Hola, ${datos.firstName}:`;
  const cuerpo = `Hemos cobrado la cuota de tu adopción de ${datos.animalName}. ¡Gracias por seguir a su lado!`;
  const recibo = lineasRecibo(datos);
  return {
    subject: `Cuota cobrada: ${datos.animalName}`,
    text: [saludo, '', cuerpo, '', ...recibo, '', datos.url, '', 'Santuario de Animales'].join('\n'),
    html: htmlConEnlace([saludo, cuerpo, ...recibo], { url: datos.url, texto: 'Ver mis animales' }),
  };
}
