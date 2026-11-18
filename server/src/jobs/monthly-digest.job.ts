import type { Language } from '@sanctuary/shared';
import { extracto, mesAnterior } from '../dominio/avisos.js';
import * as digestModel from '../models/digest.model.js';
import { monthlyDigestEmail, type ResumenAnimal } from '../services/email/templates/monthly-digest.js';
import { LOCALES } from '../utils/format.js';
import type { JobDeps } from './job.types.js';

export interface MonthlyDigestResult {
  sent: number;
  errors: number;
}

const LARGO_EXTRACTO = 200;

/** «enero de 2030» («gener de 2030», «January 2030») a partir del primer día del mes. */
function nombreDelMes(desde: string, idioma: Language = 'es'): string {
  return new Intl.DateTimeFormat(LOCALES[idioma], { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${desde}T12:00:00Z`),
  );
}

/**
 * CU-46 (tarea `monthly-digest`): resumen del mes anterior para quien lo ha
 * elegido (RN-19). Sin novedades no se envía nada. Idempotente: cada usuario
 * queda marcado con el mes resumido solo si el envío sale bien.
 */
export async function runMonthlyDigest({
  db,
  reloj,
  email,
  clientUrl,
  logError,
}: JobDeps): Promise<MonthlyDigestResult> {
  const periodo = mesAnterior(reloj.hoy());
  const resultado: MonthlyDigestResult = { sent: 0, errors: 0 };

  for (const destinatario of await digestModel.listRecipients(db, periodo.desde)) {
    const actualizaciones = await digestModel.listUpdates(db, destinatario.userId, periodo);
    // 2a: sin novedades no se envía nada (ni se marca: si llega algo atrasado, no cuenta para este mes).
    if (actualizaciones.length === 0) continue;

    const animales = new Map<number, ResumenAnimal>();
    for (const u of actualizaciones) {
      const grupo = animales.get(u.animalId) ?? { name: u.animalName, updates: [] };
      grupo.updates.push({
        title: u.title,
        excerpt: extracto(u.body, LARGO_EXTRACTO),
        url: new URL(`/my-animals/${u.animalId}`, clientUrl).toString(),
      });
      animales.set(u.animalId, grupo);
    }

    try {
      await email.send({
        to: destinatario.email,
        ...monthlyDigestEmail({
          firstName: destinatario.firstName,
          monthName: nombreDelMes(periodo.desde, destinatario.language),
          language: destinatario.language,
          animals: [...animales.values()],
          settingsUrl: new URL('/profile', clientUrl).toString(),
        }),
      });
      await digestModel.markSent(db, destinatario.userId, periodo.desde);
      resultado.sent += 1;
    } catch (error) {
      resultado.errors += 1;
      logError?.(error, `No se ha podido enviar el resumen mensual al usuario ${destinatario.userId}`);
    }
  }
  return resultado;
}
