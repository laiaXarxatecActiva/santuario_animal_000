import type { Language } from '@sanctuary/shared';
import { formatFecha } from '../../../utils/format.js';
import { htmlConEnlace, type EmailContent } from './layout.js';
import { FIRMA, idiomaDe, saludo, VER_MIS_ANIMALES } from './textos.js';

// CU-37 A1-A3: aviso al adoptante cuando un administrador pausa, reanuda o
// cancela su adopción. La nota interna del administrador nunca va en el email.
export function adoptionAdminChangeEmail(datos: {
  firstName: string;
  animalName: string;
  action: 'pause' | 'resume' | 'cancel';
  /** Próximo cobro (reanudación) o último día (cancelación). */
  date: string | null;
  url: string;
  language?: Language;
}): EmailContent {
  const idioma = idiomaDe(datos);
  const a = datos.animalName;
  const fecha = datos.date ? formatFecha(datos.date) : null;
  const t = {
    es: {
      pause: {
        subject: `Adopción pausada: ${a}`,
        cuerpo: `Hemos pausado tu adopción de ${a}. Mientras esté pausada no se te cobrará nada.`,
      },
      resume: {
        subject: `Adopción reanudada: ${a}`,
        cuerpo:
          `Hemos reanudado tu adopción de ${a}.` + (fecha ? ` La próxima cuota se cobrará a partir del ${fecha}.` : ''),
      },
      cancel: {
        subject: `Adopción cancelada: ${a}`,
        cuerpo: `Hemos cancelado tu adopción de ${a}. No se te volverá a cobrar.`,
      },
      contacto: 'Si tienes cualquier duda, responde a este email o escríbenos desde la web.',
    },
    ca: {
      pause: {
        subject: `Adopció en pausa: ${a}`,
        cuerpo: `Hem posat en pausa la teua adopció de ${a}. Mentre estiga en pausa no se't cobrarà res.`,
      },
      resume: {
        subject: `Adopció represa: ${a}`,
        cuerpo:
          `Hem reprès la teua adopció de ${a}.` + (fecha ? ` La pròxima quota es cobrarà a partir del ${fecha}.` : ''),
      },
      cancel: {
        subject: `Adopció cancel·lada: ${a}`,
        cuerpo: `Hem cancel·lat la teua adopció de ${a}. No se't tornarà a cobrar.`,
      },
      contacto: 'Si tens qualsevol dubte, respon aquest correu o escriu-nos des del web.',
    },
    en: {
      pause: {
        subject: `Adoption paused: ${a}`,
        cuerpo: `We have paused your adoption of ${a}. While it is paused you will not be charged anything.`,
      },
      resume: {
        subject: `Adoption resumed: ${a}`,
        cuerpo:
          `We have resumed your adoption of ${a}.` + (fecha ? ` The next fee will be charged from ${fecha}.` : ''),
      },
      cancel: {
        subject: `Adoption cancelled: ${a}`,
        cuerpo: `We have cancelled your adoption of ${a}. You will not be charged again.`,
      },
      contacto: 'If you have any questions, reply to this email or write to us from the website.',
    },
  }[idioma];
  const { subject, cuerpo } = t[datos.action];
  const hola = saludo(idioma, datos.firstName);
  return {
    subject,
    text: [hola, '', cuerpo, '', t.contacto, '', datos.url, '', FIRMA].join('\n'),
    html: htmlConEnlace(
      [hola, cuerpo, t.contacto],
      { url: datos.url, texto: VER_MIS_ANIMALES[idioma] },
      [],
      undefined,
      idioma,
    ),
  };
}
