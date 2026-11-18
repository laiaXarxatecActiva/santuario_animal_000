import type { Language } from '@sanctuary/shared';
import { formatEuros } from '../../../utils/format.js';
import { htmlConEnlace, type EmailContent } from './layout.js';
import { FIRMA, idiomaDe, PAGO_SIMULADO, saludo } from './textos.js';

// CU-43 3a: cuota mensual fallida; la adopción queda pausada hasta regularizarla (CU-14).
export function paymentFailedEmail(datos: {
  firstName: string;
  animalName: string;
  amount: string;
  /** Ficha de la adopción en «Mis animales», donde se reintenta el pago. */
  url: string;
  language?: Language;
}): EmailContent {
  const idioma = idiomaDe(datos);
  const a = datos.animalName;
  const importe = formatEuros(datos.amount, idioma);
  const t = {
    es: {
      subject: `No hemos podido cobrar la cuota de ${a}`,
      cuerpo: `No hemos podido cobrar la cuota de ${importe} de tu adopción de ${a}. La adopción queda pausada hasta que se regularice el pago.`,
      accion: 'Puedes volver a intentarlo desde «Mis animales»:',
      boton: 'Regularizar el pago',
    },
    ca: {
      subject: `No hem pogut cobrar la quota de ${a}`,
      cuerpo: `No hem pogut cobrar la quota de ${importe} de la teua adopció de ${a}. L'adopció queda en pausa fins que es regularitze el pagament.`,
      accion: 'Pots tornar-ho a intentar des de «Els meus animals»:',
      boton: 'Regularitzar el pagament',
    },
    en: {
      subject: `We could not collect ${a}'s fee`,
      cuerpo: `We could not collect the ${importe} fee for your adoption of ${a}. The adoption is paused until the payment is settled.`,
      accion: 'You can try again from "My animals":',
      boton: 'Settle the payment',
    },
  }[idioma];
  const hola = saludo(idioma, datos.firstName);
  const aviso = PAGO_SIMULADO[idioma];
  return {
    subject: t.subject,
    text: [hola, '', t.cuerpo, '', t.accion, datos.url, '', aviso, '', FIRMA].join('\n'),
    html: htmlConEnlace([hola, t.cuerpo, t.accion], { url: datos.url, texto: t.boton }, [aviso], undefined, idioma),
  };
}
