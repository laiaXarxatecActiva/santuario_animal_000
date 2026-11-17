import { formatEuros, formatFecha } from '../../../utils/format.js';
import { htmlConEnlace, type EmailContent } from './layout.js';

// CU-20 paso 4: cambio de plan programado para la próxima cuota.
export function planChangedEmail(datos: {
  firstName: string;
  animalName: string;
  planName: string;
  amount: string;
  /** Primera cuota con el nuevo plan (`next_billing_date`). */
  fromDate: string;
  url: string;
}): EmailContent {
  const saludo = `Hola, ${datos.firstName}:`;
  const cuerpo = `Hemos programado el cambio de plan de tu adopción de ${datos.animalName}. A partir del ${formatFecha(datos.fromDate)}, la cuota será de ${formatEuros(datos.amount)} al mes (plan ${datos.planName}).`;
  const nota = 'Hasta entonces se mantiene tu plan actual. Puedes cambiarlo de nuevo cuando quieras.';
  return {
    subject: `Cambio de plan programado: ${datos.animalName}`,
    text: [saludo, '', cuerpo, '', nota, '', datos.url, '', 'Santuario de Animales'].join('\n'),
    html: htmlConEnlace([saludo, cuerpo, nota], { url: datos.url, texto: 'Ver mis animales' }),
  };
}
