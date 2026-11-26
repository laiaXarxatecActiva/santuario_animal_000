import type { Language } from '@sanctuary/shared';
import { formatEuros, formatFecha } from '../../../utils/format.js';
import { htmlConEnlace, type EmailContent } from './layout.js';
import { FIRMA, idiomaDe, saludo } from './textos.js';

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
  language?: Language;
}): EmailContent {
  const idioma = idiomaDe(datos);
  const a = datos.animalName;
  const importe = formatEuros(datos.amount, idioma);
  const desde = formatFecha(datos.periodStart);
  const hasta = formatFecha(datos.periodEnd);
  const t = {
    es: {
      subject: `Te hemos devuelto una cuota de ${a}`,
      cuerpo: `Te hemos devuelto ${importe} de la cuota de ${a} del ${desde} al ${hasta}.`,
      online: 'La devolución se hace por el mismo medio con el que pagaste.',
      manual: 'Como la pagaste por transferencia, nos pondremos en contacto contigo para devolvértela.',
      boton: 'Ver mis aportaciones',
    },
    ca: {
      subject: `T'hem retornat una quota de ${a}`,
      cuerpo: `T'hem retornat ${importe} de la quota de ${a} del ${desde} al ${hasta}.`,
      online: 'La devolució es fa pel mateix mitjà amb què vas pagar.',
      manual: 'Com que la vas pagar per transferència, ens posarem en contacte amb tu per a retornar-te-la.',
      boton: 'Veure les meues aportacions',
    },
    en: {
      subject: `We have refunded one of ${a}'s fees`,
      cuerpo: `We have refunded ${importe} of ${a}'s fee for ${desde} to ${hasta}.`,
      online: 'The refund is made through the same method you paid with.',
      manual: 'As you paid by bank transfer, we will contact you to return it.',
      boton: 'See my contributions',
    },
  }[idioma];
  const hola = saludo(idioma, datos.firstName);
  const medio = datos.online ? t.online : t.manual;
  return {
    subject: t.subject,
    text: [hola, '', t.cuerpo, '', medio, '', datos.url, '', FIRMA].join('\n'),
    html: htmlConEnlace([hola, t.cuerpo, medio], { url: datos.url, texto: t.boton }, [], undefined, idioma),
  };
}
