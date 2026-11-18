import { htmlConEnlace, type EmailContent } from './layout.js';
import { lineasRecibo, type ReceiptData } from './receipt.js';
import { FIRMA, idiomaDe, saludo, VER_MIS_ANIMALES } from './textos.js';

// Cuota cobrada (CU-14 con una adopción pausada; también la usará el cobro mensual, CU-43).
export function paymentCompletedEmail(datos: ReceiptData): EmailContent {
  const idioma = idiomaDe(datos);
  const a = datos.animalName;
  const t = {
    es: {
      subject: `Cuota cobrada: ${a}`,
      cuerpo: `Hemos cobrado la cuota de tu adopción de ${a}. ¡Gracias por seguir a su lado!`,
    },
    ca: {
      subject: `Quota cobrada: ${a}`,
      cuerpo: `Hem cobrat la quota de la teua adopció de ${a}. Gràcies per continuar al seu costat!`,
    },
    en: {
      subject: `Fee collected: ${a}`,
      cuerpo: `We have collected the fee for your adoption of ${a}. Thank you for staying by their side!`,
    },
  }[idioma];
  const hola = saludo(idioma, datos.firstName);
  const recibo = lineasRecibo(datos);
  return {
    subject: t.subject,
    text: [hola, '', t.cuerpo, '', ...recibo, '', datos.url, '', FIRMA].join('\n'),
    html: htmlConEnlace(
      [hola, t.cuerpo, ...recibo],
      { url: datos.url, texto: VER_MIS_ANIMALES[idioma] },
      [],
      undefined,
      idioma,
    ),
  };
}
