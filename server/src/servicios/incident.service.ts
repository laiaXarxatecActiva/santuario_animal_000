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
  IncidentResolvedError,
  IncidentSameStatusError,
  NotFoundError,
  ValidationError,
} from '../errors/app-error.js';
import * as animalModel from '../models/animal-admin.model.js';
import * as incidentModel from '../models/incident.model.js';
import * as assignmentModel from '../models/shift-assignment.model.js';
import * as userModel from '../models/user.model.js';
import * as zoneModel from '../models/zone.model.js';
import { avisarAlPersonal } from './avisos-personal.js';
import type { MediaUploader } from './media-upload.service.js';
import { avisos } from './textos-avisos.js';

export interface IncidentServiceDeps {
  db: Pool;
  reloj: Reloj;
  media: MediaUploader;
  /** CU-70: la tarea puntual se crea con el caso de uso de las tareas (CU-55). */
  crearTarea: (datos: OneOffTaskData, autorId: number) => Promise<TaskDto>;
}

export type IncidentService = ReturnType<typeof createIncidentService>;

const enCampo = (field: string, message: string) => new ValidationError([{ field, message }]);
const noExiste = () => new NotFoundError('Esta incidencia no existe.');

// CU-70: incidencias. Las comunica y las ve todo el personal; el estado y la
// tarea son cosa del administrador (lo exige la ruta).
export function createIncidentService({ db, reloj, media, crearTarea }: IncidentServiceDeps) {
  async function buscar(id: number): Promise<IncidentDto> {
    const incidencia = await incidentModel.findById(db, id);
    if (!incidencia) throw noExiste();
    return incidencia;
  }

  /** La zona de la incidencia: la del animal si se eligió uno; si no, la elegida (activa). */
  async function lugar(datos: IncidentData): Promise<{ zoneId: number | null; animalId: number | null }> {
    if (datos.animalId !== null) {
      const [animal] = await animalModel.findForTasks(db, [datos.animalId]);
      if (!animal) throw enCampo('animalId', 'Este animal no existe.');
      if (estaArchivado(animal.status)) throw new CareAnimalArchivedError();
      return { zoneId: animal.zoneId ?? datos.zoneId, animalId: animal.id };
    }
    if (!(await zoneModel.isActive(db, datos.zoneId!))) {
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

    /** Comunicar una incidencia; las graves se avisan al momento. La foto se borra si algo falla. */
    async create(datos: IncidentData, autorId: number, archivo?: ArchivoSubido): Promise<IncidentDto> {
      const sitio = await lugar(datos);
      let photoUrl: string | null = null;
      if (archivo) {
        const guardada = await media.guardarImagen('incidents', archivo);
        if ('code' in guardada) throw enCampo('files', guardada.message);
        photoUrl = guardada.url;
      }
      try {
        const id = await withTransaction(db, async (client) => {
          const nuevo = await incidentModel.create(client, {
            ...datos,
            ...sitio,
            photoUrl,
            reportedBy: autorId,
            createdAt: reloj.ahora(),
          });
          if (avisarAlMomento(datos.severity)) {
            const incidencia = (await incidentModel.findById(client, nuevo))!;
            const admins = await userModel.listActiveAdminIds(client);
            const deTurno =
              sitio.zoneId === null ? [] : await assignmentModel.listUserIdsInZone(client, reloj.hoy(), sitio.zoneId);
            await avisarAlPersonal(client, destinatariosDeLaIncidencia(admins, deTurno, autorId), {
              type: 'incident_reported',
              message: avisos.incidenciaGrave(incidencia.zone?.name ?? incidencia.animal?.name ?? '', datos.title),
              link: `/admin/incidents/${nuevo}`,
            });
          }
          return nuevo;
        });
        return buscar(id);
      } catch (error) {
        if (photoUrl) await media.borrar([photoUrl]);
        throw error;
      }
    },

    /** Solo el administrador. Devuelve el estado anterior para el registro de actividad. */
    async setStatus(
      id: number,
      datos: IncidentStatusData,
      userId: number,
    ): Promise<{ antes: IncidentDto; despues: IncidentDto }> {
      const antes = await withTransaction(db, async (client) => {
        const actual = await incidentModel.findById(client, id, true);
        if (!actual) throw noExiste();
        if (comprobarCambioDeEstado(actual.status, datos.status)) throw new IncidentSameStatusError();
        await incidentModel.setStatus(
          client,
          id,
          datos.status,
          datosDeResolucion(datos.status, datos.note, userId, reloj.ahora()),
        );
        return actual;
      });
      return { antes, despues: await buscar(id) };
    },

    /** Crea una tarea puntual a partir de la incidencia; si estaba abierta, pasa a «en curso». */
    async createTask(
      id: number,
      datos: OneOffTaskData,
      userId: number,
    ): Promise<{ incident: IncidentDto; task: TaskDto; antes: IncidentDto }> {
      const antes = await buscar(id);
      if (antes.status === 'resolved') throw new IncidentResolvedError();
      if (antes.taskId !== null) throw new IncidentHasTaskError();
      const task = await crearTarea(datos, userId);
      await withTransaction(db, async (client) => {
        const actual = await incidentModel.findById(client, id, true);
        if (!actual) throw noExiste();
        await incidentModel.setTask(client, id, task.id);
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
