import type { Queryable } from '../db/pool.js';
import { limpiarDetalles } from '../dominio/actividad.js';
import { incidenciaTrasLaTarea, resolucionPorLaTarea, type CambioDeTarea } from '../dominio/incidencias.js';
import * as activityModel from '../models/activity-log.model.js';
import * as incidentModel from '../models/incident.model.js';

/** Lo que hace falta saber de la tarea que ha cambiado. */
export interface TareaQueCambia {
  incidentId: number | null;
  title: string;
  /** La nota de quien la hizo (para la resolución si la tarea la resuelve). */
  observations: string | null;
}

/**
 * CU-70: la incidencia sigue a su tarea (reglas en `incidenciaTrasLaTarea`). Lo
 * llaman todos los sitios donde una tarea deja de estar pendiente o vuelve a
 * estarlo: completarla, «no se ha podido hacer», reabrirla, borrarla y el cierre
 * del sistema al acabar el día. Va en la misma transacción que el cambio de la
 * tarea y deja el cambio de la incidencia en el registro de actividad, con quien
 * cambió la tarea (`null` si fue el sistema).
 */
export async function seguirALaTarea(
  client: Queryable,
  tarea: TareaQueCambia,
  cambio: CambioDeTarea,
  quien: number | null,
  ahora: Date,
): Promise<void> {
  if (tarea.incidentId === null) return;
  const incidencia = await incidentModel.findById(client, tarea.incidentId, true);
  if (!incidencia) return;
  const nuevo = incidenciaTrasLaTarea(incidencia.status, cambio);
  if (nuevo === null) return;
  const resolucion =
    nuevo === 'resolved'
      ? { resolution: resolucionPorLaTarea(tarea.observations, tarea.title), resolvedBy: quien, resolvedAt: ahora }
      : { resolution: null, resolvedBy: null, resolvedAt: null };
  await incidentModel.setStatus(client, incidencia.id, nuevo, resolucion);
  await activityModel.create(client, {
    userId: quien,
    action: 'update',
    tableName: 'incidents',
    recordId: incidencia.id,
    details: limpiarDetalles({ status: [incidencia.status, nuevo], task: tarea.title }),
  });
}
