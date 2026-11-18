import { formatFecha } from '../../../utils/format.js';
import { htmlConEnlace, type EmailContent } from './layout.js';

// CU-37 A1-A3: aviso al adoptante cuando un administrador pausa, reanuda o
// cancela su adopción. La nota interna del administrador nunca va en el email.
export function adoptionAdminChangeEmail(datos: {
  firstName: string;
  animalName: string;
  action: 'pause' | 'resume' | 'cancel';
  /** Próximo cobro (reanudación) o último día (cancelación). */
  date: string | null;
  url: string;
}): EmailContent {
  const saludo = `Hola, ${datos.firstName}:`;
  const { subject, cuerpo } = {
    pause: {
      subject: `Adopción pausada: ${datos.animalName}`,
      cuerpo: `Hemos pausado tu adopción de ${datos.animalName}. Mientras esté pausada no se te cobrará nada.`,
    },
    resume: {
      subject: `Adopción reanudada: ${datos.animalName}`,
      cuerpo:
        `Hemos reanudado tu adopción de ${datos.animalName}.` +
        (datos.date ? ` La próxima cuota se cobrará a partir del ${formatFecha(datos.date)}.` : ''),
    },
    cancel: {
      subject: `Adopción cancelada: ${datos.animalName}`,
      cuerpo: `Hemos cancelado tu adopción de ${datos.animalName}. No se te volverá a cobrar.`,
    },
  }[datos.action];
  const contacto = 'Si tienes cualquier duda, responde a este email o escríbenos desde la web.';
  return {
    subject,
    text: [saludo, '', cuerpo, '', contacto, '', datos.url, '', 'Santuario de Animales'].join('\n'),
    html: htmlConEnlace([saludo, cuerpo, contacto], { url: datos.url, texto: 'Ver mis animales' }),
  };
}
