import type { Language } from '@sanctuary/shared';
import { formatFecha } from '../../../utils/format.js';
import { htmlConEnlace, type EmailContent } from './layout.js';
import { FIRMA, idiomaDe, saludo, VER_MIS_ANIMALES } from './textos.js';

// CU-21 paso 5: confirmación de la baja. El texto depende de cómo queda la adopción.
export function adoptionCancelledEmail(datos: {
  firstName: string;
  animalName: string;
  /** Estado tras la baja: activa hasta `endDate`, cancelada (era pendiente) o finalizada (era pausada). */
  status: 'active' | 'cancelled' | 'finished';
  endDate: string;
  url: string;
  language?: Language;
}): EmailContent {
  const idioma = idiomaDe(datos);
  const a = datos.animalName;
  const fecha = formatFecha(datos.endDate);
  const t = {
    es: {
      subject: `Baja confirmada: ${a}`,
      active: `Hemos registrado tu baja de la adopción de ${a}. Seguirá activa hasta el ${fecha} y después no se te volverá a cobrar.`,
      cancelled: `Has cancelado la adopción de ${a}. Como el pago no se había completado, no se te ha cobrado nada.`,
      finished: `Tu adopción de ${a} ha terminado. La cuota pendiente no se cobrará.`,
      gracias: 'Gracias por tu apoyo. Puedes volver a adoptar cuando quieras.',
    },
    ca: {
      subject: `Baixa confirmada: ${a}`,
      active: `Hem registrat la teua baixa de l'adopció de ${a}. Continuarà activa fins al ${fecha} i després no se't tornarà a cobrar.`,
      cancelled: `Has cancel·lat l'adopció de ${a}. Com que el pagament no s'havia completat, no se t'ha cobrat res.`,
      finished: `La teua adopció de ${a} ha acabat. La quota pendent no es cobrarà.`,
      gracias: 'Gràcies pel teu suport. Pots tornar a adoptar quan vulgues.',
    },
    en: {
      subject: `Cancellation confirmed: ${a}`,
      active: `We have registered the cancellation of your adoption of ${a}. It will stay active until ${fecha} and you will not be charged again after that.`,
      cancelled: `You have cancelled the adoption of ${a}. As the payment had not been completed, you have not been charged anything.`,
      finished: `Your adoption of ${a} has ended. The pending fee will not be charged.`,
      gracias: 'Thank you for your support. You can adopt again whenever you like.',
    },
  }[idioma];
  const hola = saludo(idioma, datos.firstName);
  const cuerpo = t[datos.status];
  return {
    subject: t.subject,
    text: [hola, '', cuerpo, '', t.gracias, '', datos.url, '', FIRMA].join('\n'),
    html: htmlConEnlace(
      [hola, cuerpo, t.gracias],
      { url: datos.url, texto: VER_MIS_ANIMALES[idioma] },
      [],
      undefined,
      idioma,
    ),
  };
}
