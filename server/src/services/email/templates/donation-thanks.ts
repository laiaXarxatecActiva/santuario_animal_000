import type { Language } from '@sanctuary/shared';
import { fechaEnZonaSantuario } from '../../../dominio/reloj.js';
import { formatEuros, formatFecha } from '../../../utils/format.js';
import { htmlConEnlace, htmlParrafos, type EmailContent } from './layout.js';
import { FIRMA, idiomaDe, saludo } from './textos.js';

// CU-05 paso 7: agradecimiento con el recibo de la donación.
export function donationThanksEmail(datos: {
  donorName: string | null;
  amount: string;
  paidAt: Date;
  reference: string;
  language?: Language;
  /** CU-05: enlace para ver o descargar el recibo (o el certificado) en PDF. */
  receiptUrl?: string;
}): EmailContent {
  const idioma = idiomaDe(datos);
  const importe = formatEuros(datos.amount, idioma);
  const fecha = formatFecha(fechaEnZonaSantuario(datos.paidAt));
  const t = {
    es: {
      subject: '¡Gracias por tu donación!',
      cuerpo: 'Muchas gracias por tu donación. Nos ayuda a cuidar de los buitres que viven en el santuario.',
      enlace: 'Ver el recibo en PDF',
      recibo: ['Recibo: Donación', `Importe: ${importe}`, `Fecha: ${fecha}`, `Referencia: ${datos.reference}`],
    },
    ca: {
      subject: 'Gràcies per la teua donació!',
      cuerpo: 'Moltes gràcies per la teua donació. Ens ajuda a cuidar els voltors que viuen al santuari.',
      enlace: 'Veure el rebut en PDF',
      recibo: ['Rebut: Donació', `Import: ${importe}`, `Data: ${fecha}`, `Referència: ${datos.reference}`],
    },
    en: {
      subject: 'Thank you for your donation!',
      cuerpo: 'Thank you very much for your donation. It helps us care for the vultures that live at the sanctuary.',
      enlace: 'View the receipt as a PDF',
      recibo: ['Receipt: Donation', `Amount: ${importe}`, `Date: ${fecha}`, `Reference: ${datos.reference}`],
    },
  }[idioma];
  const hola = saludo(idioma, datos.donorName);
  const recibo = t.recibo;
  if (datos.receiptUrl) {
    const enlace = { url: datos.receiptUrl, texto: t.enlace };
    return {
      subject: t.subject,
      text: [hola, '', t.cuerpo, '', ...recibo, '', `${t.enlace}: ${datos.receiptUrl}`, '', FIRMA].join('\n'),
      html: htmlConEnlace([hola, t.cuerpo, ...recibo], enlace, [], undefined, idioma),
    };
  }
  return {
    subject: t.subject,
    text: [hola, '', t.cuerpo, '', ...recibo, '', FIRMA].join('\n'),
    html: htmlParrafos([hola, t.cuerpo, ...recibo, FIRMA], idioma),
  };
}
