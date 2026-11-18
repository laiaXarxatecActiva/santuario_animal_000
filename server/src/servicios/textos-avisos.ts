import type { Language } from '@sanctuary/shared';
import { formatEuros, formatFecha } from '../utils/format.js';

// Fase 3: textos de los avisos de la campana en los tres idiomas. El modelo
// guarda en cada aviso el texto del idioma de quien lo recibe.

export type Textos = Record<Language, string>;

const en3 = (f: (idioma: Language) => string): Textos => ({ es: f('es'), ca: f('ca'), en: f('en') });

export const avisos = {
  adopcionActiva: (a: string): Textos => ({
    es: `¡Ya adoptas a ${a}! Gracias por tu apoyo.`,
    ca: `Ja adoptes ${a}! Gràcies pel teu suport.`,
    en: `You now adopt ${a}! Thank you for your support.`,
  }),
  cuotaCobrada: (a: string): Textos => ({
    es: `Hemos cobrado la cuota de ${a}. ¡Gracias!`,
    ca: `Hem cobrat la quota de ${a}. Gràcies!`,
    en: `We have collected ${a}'s fee. Thank you!`,
  }),
  cuotaRegistrada: (a: string): Textos => ({
    es: `Hemos registrado el pago de la cuota de ${a}. ¡Gracias!`,
    ca: `Hem registrat el pagament de la quota de ${a}. Gràcies!`,
    en: `We have recorded the payment of ${a}'s fee. Thank you!`,
  }),
  cuotaFallida: (a: string): Textos => ({
    es: `No hemos podido cobrar la cuota de tu adopción de ${a}. La adopción está pausada hasta que se regularice el pago.`,
    ca: `No hem pogut cobrar la quota de la teua adopció de ${a}. L'adopció està en pausa fins que es regularitze el pagament.`,
    en: `We could not collect the fee for your adoption of ${a}. The adoption is paused until the payment is settled.`,
  }),
  cambioDePlan: (a: string, desde: string, importe: string, plan: string): Textos =>
    en3((idioma) => {
      const fecha = formatFecha(desde);
      const euros = formatEuros(importe, idioma);
      return {
        es: `A partir del ${fecha}, tu cuota de ${a} será de ${euros} (plan ${plan}).`,
        ca: `A partir del ${fecha}, la teua quota de ${a} serà de ${euros} (pla ${plan}).`,
        en: `From ${fecha}, your fee for ${a} will be ${euros} (${plan} plan).`,
      }[idioma];
    }),
  bajaSolicitada: (a: string, hasta: string): Textos => {
    const fecha = formatFecha(hasta);
    return {
      es: `Has solicitado la baja de ${a}. La adopción sigue activa hasta el ${fecha} y no se te volverá a cobrar.`,
      ca: `Has sol·licitat la baixa de ${a}. L'adopció continua activa fins al ${fecha} i no se't tornarà a cobrar.`,
      en: `You have asked to cancel ${a}'s adoption. It stays active until ${fecha} and you will not be charged again.`,
    };
  },
  bajaTerminada: (a: string): Textos => ({
    es: `Tu adopción de ${a} ha terminado. No se te cobrará nada más.`,
    ca: `La teua adopció de ${a} ha acabat. No se't cobrarà res més.`,
    en: `Your adoption of ${a} has ended. You will not be charged anything else.`,
  }),
  gracias: (importe: string): Textos =>
    en3(
      (idioma) =>
        ({
          es: `Gracias por tu donación de ${formatEuros(importe, idioma)}.`,
          ca: `Gràcies per la teua donació de ${formatEuros(importe, idioma)}.`,
          en: `Thank you for your donation of ${formatEuros(importe, idioma)}.`,
        })[idioma],
    ),
  cuotaDevuelta: (a: string, importe: string): Textos =>
    en3(
      (idioma) =>
        ({
          es: `Te hemos devuelto ${formatEuros(importe, idioma)} de la cuota de ${a}.`,
          ca: `T'hem retornat ${formatEuros(importe, idioma)} de la quota de ${a}.`,
          en: `We have refunded ${formatEuros(importe, idioma)} of ${a}'s fee.`,
        })[idioma],
    ),
  donacionDevuelta: (importe: string): Textos =>
    en3(
      (idioma) =>
        ({
          es: `Te hemos devuelto tu donación de ${formatEuros(importe, idioma)}.`,
          ca: `T'hem retornat la teua donació de ${formatEuros(importe, idioma)}.`,
          en: `We have refunded your donation of ${formatEuros(importe, idioma)}.`,
        })[idioma],
    ),
  fallecido: (a: string): Textos => ({
    es: `Lamentamos comunicarte que ${a} ha fallecido. Tu adopción se ha cerrado.`,
    ca: `Lamentem comunicar-te que ${a} ha mort. La teua adopció s'ha tancat.`,
    en: `We are sorry to tell you that ${a} has passed away. Your adoption has been closed.`,
  }),
  trasladado: (a: string): Textos => ({
    es: `${a} se ha trasladado a otro centro. Tu adopción se ha cerrado.`,
    ca: `${a} s'ha traslladat a un altre centre. La teua adopció s'ha tancat.`,
    en: `${a} has moved to another centre. Your adoption has been closed.`,
  }),
  nuevaActualizacion: (a: string, titulo: string): Textos => ({
    es: `Nueva actualización de ${a}: «${titulo}».`,
    ca: `Nova actualització de ${a}: «${titulo}».`,
    en: `New update about ${a}: "${titulo}".`,
  }),
  pausadaPorAdmin: (a: string): Textos => ({
    es: `Hemos pausado tu adopción de ${a}. Mientras esté pausada no se te cobrará nada.`,
    ca: `Hem posat en pausa la teua adopció de ${a}. Mentre estiga en pausa no se't cobrarà res.`,
    en: `We have paused your adoption of ${a}. While it is paused you will not be charged anything.`,
  }),
  reanudadaPorAdmin: (a: string): Textos => ({
    es: `Hemos reanudado tu adopción de ${a}.`,
    ca: `Hem reprès la teua adopció de ${a}.`,
    en: `We have resumed your adoption of ${a}.`,
  }),
  canceladaPorAdmin: (a: string): Textos => ({
    es: `Hemos cancelado tu adopción de ${a}. No se te volverá a cobrar.`,
    ca: `Hem cancel·lat la teua adopció de ${a}. No se't tornarà a cobrar.`,
    en: `We have cancelled your adoption of ${a}. You will not be charged again.`,
  }),
  finalizada: (a: string): Textos => ({
    es: `Tu adopción de ${a} ha terminado. Gracias por tu apoyo durante este tiempo; puedes volver a adoptar cuando quieras.`,
    ca: `La teua adopció de ${a} ha acabat. Gràcies pel teu suport durant este temps; pots tornar a adoptar quan vulgues.`,
    en: `Your adoption of ${a} has ended. Thank you for your support during this time; you can adopt again whenever you like.`,
  }),
  caducada: (a: string): Textos => ({
    es: `Tu adopción de ${a} se ha cancelado porque no se completó el pago en 7 días. Puedes intentarlo de nuevo cuando quieras.`,
    ca: `La teua adopció de ${a} s'ha cancel·lat perquè no es va completar el pagament en 7 dies. Pots tornar-ho a intentar quan vulgues.`,
    en: `Your adoption of ${a} has been cancelled because the payment was not completed within 7 days. You can try again whenever you like.`,
  }),
  sinActualizar: (a: string, dias: number): Textos => ({
    es: `${a} lleva ${dias} días sin actualización.`,
    ca: `${a} porta ${dias} dies sense actualització.`,
    en: `${a} has gone ${dias} days without an update.`,
  }),
};
