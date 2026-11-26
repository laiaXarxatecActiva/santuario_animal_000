import type {
  IncidentData,
  IncidentDto,
  IncidentSummaryDto,
  IncidentStatusData,
  IncidentsQuery,
  OneOffTaskData,
  Paginated,
  TaskDto,
} from '@sanctuary/shared';
import type { Pool } from 'pg';
import { withTransaction } from '../db/transaction.js';
import { estaArchivado } from '../dominio/animal.js';
import type { ArchivoSubido } from '../dominio/fotos.js';
import {
  TAREA_YA_NO_HACE_FALTA,
  avisarAlMomento,
  comprobarCambioDeEstado,
  datosDeResolucion,
  destinatariosDeLaIncidencia,
} from '../dominio/incidencias.js';
import { paginar } from '../dominio/paginacion.js';
import type { Reloj } from '../dominio/reloj.js';
import {
  CareAnimalArchivedError,
  IncidentHasTaskError,
  IncidentNotResolvedError,
  IncidentResolvedError,
  IncidentSameStatusError,
  NotFoundError,
  ValidationError,
} from '../errors/app-error.js';
import * as animalModel from '../models/animal-admin.model.js';
import * as incidentModel from '../models/incident.model.js';
import * as assignmentModel from '../models/shift-assignment.model.js';
import * as taskModel from '../models/task.model.js';
import * as userModel from '../models/user.model.js';
import * as zoneModel from '../models/zone.model.js';
import { avisarAlPersonal } from './avisos-personal.js';
import type { MediaUploader } from './media-upload.service.js';
import { avisos } from './textos-avisos.js';

export interface IncidentServiceDeps {
  db: Pool;
  reloj: Reloj;
  media: MediaUploader;
  /** CU-70: la tarea puntual se crea con el caso de uso de las tareas (CU-55), unida a la incidencia. */
  crearTarea: (datos: OneOffTaskData, autorId: number, incidentId: number) => Promise<TaskDto>;
}

export type IncidentService = ReturnType<typeof createIncidentService>;

const enCampo = (field: string, message: string) => new ValidationError([{ field, message }]);
const noExiste = () => new NotFoundError('Esta incidencia no existe.');

// CU-70: incidencias. Las comunica, las ve, las resuelve y las reabre todo el
// personal; la tarea es cosa del administrador (lo exige la ruta). «En curso»
// quiere decir que tiene una tarea pendiente: la incidencia sigue a su tarea
// (`seguirALaTarea`).
export function createIncidentService({ db, reloj, media, crearTarea }: IncidentServiceDeps) {
  async function buscar(id: number): Promise<IncidentDto> {
    const incidencia = await incidentModel.findById(db, id);
    if (!incidencia) throw noExiste();
    return incidencia;
  }

  /** La zona de la incidencia: la del animal si se eligió uno; si no, la elegida (activa) o ninguna. */
  async function lugar(datos: IncidentData): Promise<{ zoneId: number | null; animalId: number | null }> {
    if (datos.animalId !== null) {
      const [animal] = await animalModel.findForTasks(db, [datos.animalId]);
      if (!animal) throw enCampo('animalId', 'Este animal no existe.');
      if (estaArchivado(animal.status)) throw new CareAnimalArchivedError();
      return { zoneId: animal.zoneId ?? datos.zoneId, animalId: animal.id };
    }
    if (datos.zoneId === null) return { zoneId: null, animalId: null };
    if (!(await zoneModel.isActive(db, datos.zoneId))) {
      throw enCampo('zoneId', 'Esta zona no existe o está desactivada.');
    }
    return { zoneId: datos.zoneId, animalId: null };
  }

  return {
    /** Las pendientes: abiertas y en curso. */
    async summary(): Promise<IncidentSummaryDto> {
      const recuento = await incidentModel.countByStatus(db);
      return { open: recuento.open, inProgress: recuento.in_progress };
    },

    async list(query: IncidentsQuery): Promise<Paginated<IncidentDto>> {
      const { page, pageSize, ...filtros } = query;
      const pagina = paginar({ page, pageSize }, await incidentModel.count(db, filtros));
      const data = await incidentModel.list(db, filtros, { limit: pagina.pageSize, offset: pagina.offset });
      return {
        data,
        meta: { page: pagina.page, pageSize: pagina.pageSize, total: pagina.total, totalPages: pagina.totalPages },
      };
    },

    get: buscar,

    /** Comunicar una incidencia (con hasta 5 fotos); las graves se avisan al momento. Las fotos se borran si algo falla. */
    async create(datos: IncidentData, autorId: number, archivos: readonly ArchivoSubido[] = []): Promise<IncidentDto> {
      const sitio = await lugar(datos);
      const fotos: string[] = [];
      for (const archivo of archivos) {
        const guardada = await media.guardarImagen('incidents', archivo);
        if ('code' in guardada) {
          await media.borrar(fotos);
          throw enCampo('files', guardada.message);
        }
        fotos.push(guardada.url);
      }
      try {
        const id = await withTransaction(db, async (client) => {
          const nuevo = await incidentModel.create(client, {
            ...datos,
            ...sitio,
            reportedBy: autorId,
            createdAt: reloj.ahora(),
          });
          await incidentModel.addPhotos(client, nuevo, fotos);
          if (avisarAlMomento(datos.severity)) {
            const incidencia = (await incidentModel.findById(client, nuevo))!;
            const admins = await userModel.listActiveAdminIds(client);
            const deTurno =
              sitio.zoneId === null ? [] : await assignmentModel.listUserIdsInZone(client, reloj.hoy(), sitio.zoneId);
            await avisarAlPersonal(client, destinatariosDeLaIncidencia(admins, deTurno, autorId), {
              type: 'incident_reported',
              message: avisos.incidenciaGrave(incidencia.zone?.name ?? incidencia.animal?.name ?? null, datos.title),
              link: `/admin/incidents/${nuevo}`,
            });
          }
          return nuevo;
        });
        return buscar(id);
      } catch (error) {
        if (fotos.length > 0) await media.borrar(fotos);
        throw error;
      }
    },

    /**
     * Resolverla o reabrirla. Al resolverla, su tarea pendiente (si la tiene) se
     * cierra como «no realizada»: ya no hace falta. Devuelve el estado anterior para
     * el registro de actividad.
     */
    async setStatus(
      id: number,
      datos: IncidentStatusData,
      userId: number,
    ): Promise<{ antes: IncidentDto; despues: IncidentDto }> {
      const antes = await withTransaction(db, async (client) => {
        const actual = await incidentModel.findById(client, id, true);
        if (!actual) throw noExiste();
        const problema = comprobarCambioDeEstado(actual.status, datos.status);
        if (problema === 'SAME_STATUS') throw new IncidentSameStatusError();
        if (problema === 'NOT_RESOLVED') throw new IncidentNotResolvedError();
        if (problema === 'BY_TASK') throw enCampo('status', 'Elige el estado.');
        await incidentModel.setStatus(
          client,
          id,
          datos.status,
          datosDeResolucion(datos.status, datos.note, userId, reloj.ahora()),
        );
        const pendiente = datos.status === 'resolved' ? await taskModel.findPendingOfIncident(client, id) : null;
        if (pendiente !== null) {
          await taskModel.resolve(client, pendiente, {
            status: 'not_done',
            resolvedBy: userId,
            resolvedAt: reloj.ahora(),
            observations: TAREA_YA_NO_HACE_FALTA,
          });
        }
        return actual;
      });
      return { antes, despues: await buscar(id) };
    },

    /**
     * Crea una tarea puntual a partir de la incidencia (solo si no está resuelta ni
     * tiene otra pendiente); si estaba abierta, pasa a «en curso».
     */
    async createTask(
      id: number,
      datos: OneOffTaskData,
      userId: number,
    ): Promise<{ incident: IncidentDto; task: TaskDto; antes: IncidentDto }> {
      const antes = await buscar(id);
      if (antes.status === 'resolved') throw new IncidentResolvedError();
      if (antes.tasks.some((t) => t.status === 'pending')) throw new IncidentHasTaskError();
      const task = await crearTarea(datos, userId, id);
      await withTransaction(db, async (client) => {
        const actual = await incidentModel.findById(client, id, true);
        if (!actual) throw noExiste();
        if (actual.status === 'open') {
          await incidentModel.setStatus(
            client,
            id,
            'in_progress',
            datosDeResolucion('in_progress', null, userId, reloj.ahora()),
          );
        }
      });
      return { incident: await buscar(id), task, antes };
    },
  };
}
