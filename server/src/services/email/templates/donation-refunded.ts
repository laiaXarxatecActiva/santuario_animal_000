import type { Language } from '@sanctuary/shared';
import { formatEuros } from '../../../utils/format.js';
import { htmlParrafos, type EmailContent } from './layout.js';
import { FIRMA, idiomaDe, saludo } from './textos.js';

// CU-39 A2: aviso de una donación devuelta. Los emails de pagos se envían siempre (RN-19).
export function donationRefundedEmail(datos: {
  donorName: string | null;
  amount: string;
  reference: string;
  /** Hecha en la web: se devuelve por el mismo medio. Si no, a mano. */
  online: boolean;
  language?: Language;
}): EmailContent {
  const idioma = idiomaDe(datos);
  const importe = formatEuros(datos.amount, idioma);
  const t = {
    es: {
      subject: 'Te hemos devuelto tu donación',
      cuerpo: `Te hemos devuelto tu donación de ${importe} (referencia ${datos.reference}).`,
      online: 'La devolución se hace por el mismo medio con el que pagaste.',
      manual: 'Como la hiciste en efectivo o por transferencia, nos pondremos en contacto contigo para devolvértela.',
      gracias: 'Gracias de todos modos por pensar en los buitres del santuario.',
    },
    ca: {
      subject: "T'hem retornat la teua donació",
      cuerpo: `T'hem retornat la teua donació de ${importe} (referència ${datos.reference}).`,
      online: 'La devolució es fa pel mateix mitjà amb què vas pagar.',
      manual: 'Com que la vas fer en efectiu o per transferència, ens posarem en contacte amb tu per a retornar-te-la.',
      gracias: 'Gràcies de totes maneres per pensar en els voltors del santuari.',
    },
    en: {
      subject: 'We have refunded your donation',
      cuerpo: `We have refunded your donation of ${importe} (reference ${datos.reference}).`,
      online: 'The refund is made through the same method you paid with.',
      manual: 'As you made it in cash or by bank transfer, we will contact you to return it.',
      gracias: 'Thank you anyway for thinking of the sanctuary vultures.',
    },
  }[idioma];
  const hola = saludo(idioma, datos.donorName);
  const medio = datos.online ? t.online : t.manual;
  return {
    subject: t.subject,
    text: [hola, '', t.cuerpo, '', medio, '', t.gracias, '', FIRMA].join('\n'),
    html: htmlParrafos([hola, t.cuerpo, medio, t.gracias, FIRMA], idioma),
  };
}
