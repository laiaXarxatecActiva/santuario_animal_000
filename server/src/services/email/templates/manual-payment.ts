import type { Language } from '@sanctuary/shared';
import { formatEuros, formatFecha } from '../../../utils/format.js';
import { htmlConEnlace, type EmailContent } from './layout.js';
import { FIRMA, idiomaDe, saludo } from './textos.js';

interface DatosCuota {
  firstName: string;
  animalName: string;
  amount: string;
  /** «Mis animales», donde se paga la cuota. */
  url: string;
  language?: Language;
}

/** Arma el email: saludo, cuerpo y acción con el botón. */
function componer(
  datos: DatosCuota,
  t: { subject: string; cuerpo: string; accion: string; boton: string },
  idioma: Language,
): EmailContent {
  const hola = saludo(idioma, datos.firstName);
  return {
    subject: t.subject,
    text: [hola, '', t.cuerpo, '', t.accion, datos.url, '', FIRMA].join('\n'),
    html: htmlConEnlace([hola, t.cuerpo, t.accion], { url: datos.url, texto: t.boton }, [], undefined, idioma),
  };
}

// CU-50: la cuota de una adopción con pago manual vence pronto (7 días antes).
export function manualPaymentDueEmail(datos: DatosCuota & { dueDate: string; deadline: string }): EmailContent {
  const idioma = idiomaDe(datos);
  const a = datos.animalName;
  const importe = formatEuros(datos.amount, idioma);
  const vence = formatFecha(datos.dueDate);
  const hasta = formatFecha(datos.deadline);
  const t = {
    es: {
      subject: `La cuota de ${a} vence el ${vence}`,
      cuerpo: `La cuota de ${importe} de tu adopción de ${a} vence el ${vence}. Como elegiste el pago manual, tienes que pagarla tú. Si no la has pagado el ${hasta}, la adopción se pausará.`,
      accion: 'Puedes pagarla ya desde «Mis animales»:',
      boton: 'Pagar la cuota',
    },
    ca: {
      subject: `La quota de ${a} venç el ${vence}`,
      cuerpo: `La quota de ${importe} de la teua adopció de ${a} venç el ${vence}. Com que vas triar el pagament manual, l'has de pagar tu. Si no l'has pagada el ${hasta}, l'adopció es posarà en pausa.`,
      accion: 'Pots pagar-la ja des de «Els meus animals»:',
      boton: 'Paga la quota',
    },
    en: {
      subject: `${a}'s fee is due on ${vence}`,
      cuerpo: `The ${importe} fee for your adoption of ${a} is due on ${vence}. As you chose manual payment, you need to pay it yourself. If it has not been paid by ${hasta}, the adoption will be paused.`,
      accion: 'You can pay it now from "My animals":',
      boton: 'Pay the fee',
    },
  }[idioma];
  return componer(datos, t, idioma);
}

// CU-50: pasaron los 7 días de margen sin pagar la cuota manual: la adopción se pausa.
export function manualPaymentOverdueEmail(datos: DatosCuota): EmailContent {
  const idioma = idiomaDe(datos);
  const a = datos.animalName;
  const importe = formatEuros(datos.amount, idioma);
  const t = {
    es: {
      subject: `Hemos pausado tu adopción de ${a}`,
      cuerpo: `No hemos recibido el pago de la cuota de ${importe} de tu adopción de ${a}. La adopción queda pausada hasta que la pagues.`,
      accion: 'Puedes pagarla desde «Mis animales»:',
      boton: 'Pagar ahora',
    },
    ca: {
      subject: `Hem posat en pausa la teua adopció de ${a}`,
      cuerpo: `No hem rebut el pagament de la quota de ${importe} de la teua adopció de ${a}. L'adopció queda en pausa fins que la pagues.`,
      accion: 'Pots pagar-la des de «Els meus animals»:',
      boton: 'Paga ara',
    },
    en: {
      subject: `We have paused your adoption of ${a}`,
      cuerpo: `We have not received the payment of the ${importe} fee for your adoption of ${a}. The adoption is paused until you pay it.`,
      accion: 'You can pay it from "My animals":',
      boton: 'Pay now',
    },
  }[idioma];
  return componer(datos, t, idioma);
}
