import type { Queryable } from '../db/pool.js';
import { claveAvisoComePoco, destinatariosDelAviso, rachaDeComerPoco } from '../dominio/cuidados.js';
import * as feedingModel from '../models/feeding-log.model.js';
import * as assignmentModel from '../models/shift-assignment.model.js';
import * as staffAlertModel from '../models/staff-alert.model.js';
import * as userModel from '../models/user.model.js';
import { avisos } from './textos-avisos.js';
import { avisarAlPersonal } from './avisos-personal.js';

// CU-67 a CU-69: avisos de la campana sobre los cuidados de los animales.

/** Tomas que se miran hacia atrás para encontrar el principio de una racha. */
const TOMAS_REVISADAS = 100;

/** Los administradores activos y quien tiene turno ese día en la zona del animal. */
export async function destinatarios(q: Queryable, fecha: string, zoneId: number | null): Promise<number[]> {
  const admins = await userModel.listActiveAdminIds(q);
  const deTurno = zoneId === null ? [] : await assignmentModel.listUserIdsInZone(q, fecha, zoneId);
  return destinatariosDelAviso(admins, deTurno);
}

export const enlaceCuidados = (animalId: number) => `/admin/animals/${animalId}/care`;

/**
 * CU-67: si el animal lleva `umbral` tomas seguidas (o más) comiendo poco,
 * avisa una vez por racha. Devuelve si ha avisado.
 */
export async function avisarSiComePoco(
  q: Queryable,
  animal: { id: number; name: string },
  datos: { hoy: string; zoneId: number | null; umbral: number },
): Promise<boolean> {
  const racha = rachaDeComerPoco(await feedingModel.recentOfAnimal(q, animal.id, TOMAS_REVISADAS));
  if (racha.longitud < datos.umbral) return false;
  if (!(await staffAlertModel.registerIfNew(q, 'low_intake', claveAvisoComePoco(animal.id, racha)))) return false;
  await avisarAlPersonal(q, await destinatarios(q, datos.hoy, datos.zoneId), {
    type: 'low_intake',
    message: avisos.comePoco(animal.name, racha.longitud),
    link: enlaceCuidados(animal.id),
  });
  return true;
}
