import type { Language } from '@sanctuary/shared';
import { formatEuros, formatFecha } from '../../../utils/format.js';
import { htmlConEnlace, type EmailContent } from './layout.js';
import { FIRMA, idiomaDe, saludo, VER_MIS_ANIMALES } from './textos.js';

// CU-20 paso 4: cambio de plan programado para la próxima cuota.
export function planChangedEmail(datos: {
  firstName: string;
  animalName: string;
  planName: string;
  amount: string;
  /** Primera cuota con el nuevo plan (`next_billing_date`). */
  fromDate: string;
  url: string;
  language?: Language;
}): EmailContent {
  const idioma = idiomaDe(datos);
  const a = datos.animalName;
  const importe = formatEuros(datos.amount, idioma);
  const fecha = formatFecha(datos.fromDate);
  const t = {
    es: {
      subject: `Cambio de plan programado: ${a}`,
      cuerpo: `Hemos programado el cambio de plan de tu adopción de ${a}. A partir del ${fecha}, la cuota será de ${importe} al mes (plan ${datos.planName}).`,
      nota: 'Hasta entonces se mantiene tu plan actual. Puedes cambiarlo de nuevo cuando quieras.',
    },
    ca: {
      subject: `Canvi de pla programat: ${a}`,
      cuerpo: `Hem programat el canvi de pla de la teua adopció de ${a}. A partir del ${fecha}, la quota serà de ${importe} al mes (pla ${datos.planName}).`,
      nota: 'Fins aleshores es manté el teu pla actual. Pots tornar a canviar-lo quan vulgues.',
    },
    en: {
      subject: `Plan change scheduled: ${a}`,
      cuerpo: `We have scheduled the plan change for your adoption of ${a}. From ${fecha}, the fee will be ${importe} a month (${datos.planName} plan).`,
      nota: 'Until then your current plan stays the same. You can change it again whenever you like.',
    },
  }[idioma];
  const hola = saludo(idioma, datos.firstName);
  return {
    subject: t.subject,
    text: [hola, '', t.cuerpo, '', t.nota, '', datos.url, '', FIRMA].join('\n'),
    html: htmlConEnlace(
      [hola, t.cuerpo, t.nota],
      { url: datos.url, texto: VER_MIS_ANIMALES[idioma] },
      [],
      undefined,
      idioma,
    ),
  };
}
