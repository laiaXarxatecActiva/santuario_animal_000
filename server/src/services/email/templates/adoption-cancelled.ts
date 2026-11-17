import { formatFecha } from '../../../utils/format.js';
import { htmlConEnlace, type EmailContent } from './layout.js';

// CU-21 paso 5: confirmación de la baja. El texto depende de cómo queda la adopción.
export function adoptionCancelledEmail(datos: {
  firstName: string;
  animalName: string;
  /** Estado tras la baja: activa hasta `endDate`, cancelada (era pendiente) o finalizada (era pausada). */
  status: 'active' | 'cancelled' | 'finished';
  endDate: string;
  url: string;
}): EmailContent {
  const saludo = `Hola, ${datos.firstName}:`;
  const fecha = formatFecha(datos.endDate);
  const cuerpo = {
    active: `Hemos registrado tu baja de la adopción de ${datos.animalName}. Seguirá activa hasta el ${fecha} y después no se te volverá a cobrar.`,
    cancelled: `Has cancelado la adopción de ${datos.animalName}. Como el pago no se había completado, no se te ha cobrado nada.`,
    finished: `Tu adopción de ${datos.animalName} ha terminado. La cuota pendiente no se cobrará.`,
  }[datos.status];
  const gracias = 'Gracias por tu apoyo. Puedes volver a adoptar cuando quieras.';
  return {
    subject: `Baja confirmada: ${datos.animalName}`,
    text: [saludo, '', cuerpo, '', gracias, '', datos.url, '', 'Santuario de Animales'].join('\n'),
    html: htmlConEnlace([saludo, cuerpo, gracias], { url: datos.url, texto: 'Ver mis animales' }),
  };
}
