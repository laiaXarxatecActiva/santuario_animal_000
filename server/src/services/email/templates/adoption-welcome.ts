import { htmlConEnlace, type EmailContent } from './layout.js';
import { lineasRecibo, type ReceiptData } from './receipt.js';

// CU-13 paso 8 y CU-14: adopción activada, con el recibo de la primera cuota.
export function adoptionWelcomeEmail(datos: ReceiptData): EmailContent {
  const saludo = `Hola, ${datos.firstName}:`;
  const cuerpo = `¡Gracias por adoptar a ${datos.animalName}! Seguirá viviendo en el santuario y te contaremos cómo está al menos cada dos semanas.`;
  // CU-22 (Fase 3): el certificado se descarga desde «Mis animales» (el enlace del email).
  const certificado = `Desde «Mis animales» puedes descargar el certificado de adopción de ${datos.animalName}.`;
  const recibo = lineasRecibo(datos);
  return {
    subject: `¡Ya adoptas a ${datos.animalName}!`,
    text: [saludo, '', cuerpo, '', certificado, '', ...recibo, '', datos.url, '', 'Santuario de Animales'].join('\n'),
    html: htmlConEnlace([saludo, cuerpo, certificado, ...recibo], { url: datos.url, texto: 'Ver mis animales' }),
  };
}
