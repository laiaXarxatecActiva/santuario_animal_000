import {
  FEEDING_HISTORY_DAYS,
  type AnimalCareDto,
  type AnimalStatus,
  type DietItemData,
  type DietItemDto,
  type MedicationPlanData,
  type MedicationPlanDto,
  type SessionUser,
  type VetRecordData,
  type VetVisitData,
  type VetVisitDto,
} from '@sanctuary/shared';
import type { Pool } from 'pg';
import type { Queryable } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { estaArchivado } from '../dominio/animal.js';
import { comprobarRegistroVisita, comprobarTerminarPauta, rachaDeComerPoco } from '../dominio/cuidados.js';
import { instanteEnZonaSantuario, type Reloj } from '../dominio/reloj.js';
import { sumarDias } from '../dominio/tareas.js';
import { comprobarFechaRegistro, MENSAJE_FECHA_REGISTRO } from '../dominio/veterinario.js';
import {
  AnimalWithoutZoneError,
  CareAnimalArchivedError,
  MedicationPlanEndedError,
  MedicationPlanHasHistoryError,
  MedicationPlanNotStartedError,
  NotFoundError,
  ValidationError,
  VetVisitFutureDayError,
  VetVisitNotScheduledError,
} from '../errors/app-error.js';
import * as animalModel from '../models/animal-admin.model.js';
import * as dietModel from '../models/diet-item.model.js';
import * as feedingModel from '../models/feeding-log.model.js';
import * as planModel from '../models/medication-plan.model.js';
import * as qualificationModel from '../models/qualification.model.js';
import * as taskModel from '../models/task.model.js';
import * as vetRecordModel from '../models/vet-record.model.js';
import * as visitModel from '../models/vet-visit.model.js';
import { generarParaPauta } from './generacion-tareas.js';

export interface CareServiceDeps {
  db: Pool;
  reloj: Reloj;
}

export type CareService = ReturnType<typeof createCareService>;

interface AnimalDeCuidados {
  id: number;
  name: string;
  status: AnimalStatus;
  zoneId: number | null;
}

const enCampo = (field: string, message: string) => new ValidationError([{ field, message }]);
const animalNoExiste = () => new NotFoundError('Este animal no existe.');
const alimentoNoExiste = () => new NotFoundError('Este alimento de la dieta no existe.');
const pautaNoExiste = () => new NotFoundError('Esta pauta de medicación no existe.');
const visitaNoExiste = () => new NotFoundError('Esta visita veterinaria no existe.');

// CU-65 a CU-69: pestaña «Cuidados» de la ficha del animal (cuidadores y administradores).
export function createCareService({ db, reloj }: CareServiceDeps) {
  async function animal(q: Queryable, id: number): Promise<AnimalDeCuidados> {
    const [encontrado] = await animalModel.findForTasks(q, [id]);
    if (!encontrado) throw animalNoExiste();
    return encontrado;
  }

  /** Solo se cambian los cuidados de un animal que sigue en el santuario. */
  async function animalEnElSantuario(q: Queryable, id: number): Promise<AnimalDeCuidados> {
    const a = await animal(q, id);
    if (estaArchivado(a.status)) throw new CareAnimalArchivedError();
    return a;
  }

  /** Las tareas de las pautas y las visitas son de la zona del animal. */
  async function animalConZona(q: Queryable, id: number): Promise<AnimalDeCuidados & { zoneId: number }> {
    const a = await animalEnElSantuario(q, id);
    if (a.zoneId === null) throw new AnimalWithoutZoneError();
    return { ...a, zoneId: a.zoneId };
  }

  async function comprobarCualificacion(q: Queryable, id: number | null): Promise<void> {
    if (id !== null && !(await qualificationModel.findById(q, id))) {
      throw enCampo('qualificationId', 'Esta cualificación no existe.');
    }
  }

  async function buscarPauta(q: Queryable, id: number, forUpdate = false): Promise<MedicationPlanDto> {
    const pauta = await planModel.findById(q, id, reloj.hoy(), { forUpdate });
    if (!pauta) throw pautaNoExiste();
    return pauta;
  }

  async function buscarVisita(q: Queryable, id: number, forUpdate = false): Promise<VetVisitDto> {
    const visita = await visitModel.findById(q, id, { forUpdate });
    if (!visita) throw visitaNoExiste();
    return visita;
  }

  /** CU-68: la tarea de la visita en «Mi día», en la zona del animal. */
  async function crearTareaDeVisita(
    q: Queryable,
    visitaId: number,
    a: { id: number; zoneId: number },
    datos: VetVisitData,
    autorId: number,
  ): Promise<void> {
    await taskModel.insert(q, {
      templateId: null,
      vetVisitId: visitaId,
      type: 'health_check',
      title: datos.reason,
      description: null,
      zoneId: a.zoneId,
      qualificationId: null,
      dueDate: datos.date,
      dueTime: datos.time,
      dueAt: instanteEnZonaSantuario(datos.date, datos.time),
      assignedTo: null,
      createdBy: autorId,
      animalIds: [a.id],
    });
  }

  function comprobarDiaDeVisita(datos: VetVisitData): void {
    if (datos.date < reloj.hoy()) throw enCampo('date', 'No se puede programar una visita en un día pasado.');
  }

  return {
    /** La pestaña «Cuidados». */
    async get(animalId: number): Promise<AnimalCareDto> {
      await animal(db, animalId);
      const hoy = reloj.hoy();
      const [diet, feedings, recientes, medicationPlans, vetVisits] = await Promise.all([
        dietModel.listByAnimal(db, animalId, hoy),
        feedingModel.listOfAnimal(db, animalId, sumarDias(hoy, -(FEEDING_HISTORY_DAYS - 1))),
        feedingModel.recentOfAnimal(db, animalId, 100),
        planModel.listByAnimal(db, animalId, hoy),
        visitModel.listByAnimal(db, animalId),
      ]);
      return {
        animalId,
        diet,
        feedings,
        lowIntakeStreak: rachaDeComerPoco(recientes).longitud,
        medicationPlans,
        vetVisits,
      };
    },

    // CU-65: dieta.
    async createDietItem(animalId: number, datos: DietItemData, autorId: number): Promise<DietItemDto> {
      await animalEnElSantuario(db, animalId);
      const id = await dietModel.create(db, animalId, datos, autorId);
      return (await dietModel.findById(db, id, reloj.hoy()))!;
    },

    async getDietItem(id: number): Promise<DietItemDto> {
      const item = await dietModel.findById(db, id, reloj.hoy());
      if (!item) throw alimentoNoExiste();
      return item;
    },

    async updateDietItem(id: number, datos: DietItemData): Promise<DietItemDto> {
      const antes = await this.getDietItem(id);
      await animalEnElSantuario(db, antes.animalId);
      await dietModel.update(db, id, datos);
      return (await dietModel.findById(db, id, reloj.hoy()))!;
    },

    async removeDietItem(id: number): Promise<DietItemDto> {
      const item = await this.getDietItem(id);
      await dietModel.remove(db, id);
      return item;
    },

    // CU-69: pautas de medicación.
    async createPlan(animalId: number, datos: MedicationPlanData, autorId: number): Promise<MedicationPlanDto> {
      return withTransaction(db, async (client) => {
        await animalConZona(client, animalId);
        await comprobarCualificacion(client, datos.qualificationId);
        const id = await planModel.create(client, animalId, datos, autorId);
        await generarParaPauta(client, id, reloj.hoy(), reloj.ahora());
        return buscarPauta(client, id);
      });
    },

    getPlan: (id: number) => buscarPauta(db, id),

    /** Las dosis pendientes de ahora en adelante se rehacen con los datos nuevos. */
    async updatePlan(id: number, datos: MedicationPlanData): Promise<MedicationPlanDto> {
      return withTransaction(db, async (client) => {
        const antes = await buscarPauta(client, id, true);
        await animalConZona(client, antes.animalId);
        await comprobarCualificacion(client, datos.qualificationId);
        await planModel.update(client, id, datos);
        await taskModel.deletePendingOfPlan(client, id, reloj.ahora());
        await generarParaPauta(client, id, reloj.hoy(), reloj.ahora());
        return buscarPauta(client, id);
      });
    },

    /** Termina hoy: las dosis que faltan desaparecen. */
    async endPlan(id: number): Promise<MedicationPlanDto> {
      return withTransaction(db, async (client) => {
        const pauta = await buscarPauta(client, id, true);
        const motivo = comprobarTerminarPauta(pauta, reloj.hoy());
        if (motivo === 'NOT_STARTED') throw new MedicationPlanNotStartedError();
        if (motivo === 'ALREADY_ENDED') throw new MedicationPlanEndedError();
        await planModel.setEndDate(client, id, reloj.hoy());
        await taskModel.deletePendingOfPlan(client, id, reloj.ahora());
        return buscarPauta(client, id);
      });
    },

    /** Con dosis resueltas no se borra: se termina. */
    async removePlan(id: number): Promise<MedicationPlanDto> {
      return withTransaction(db, async (client) => {
        const pauta = await buscarPauta(client, id, true);
        if (await taskModel.planHasHistory(client, id)) throw new MedicationPlanHasHistoryError();
        await planModel.remove(client, id);
        return pauta;
      });
    },

    // CU-68: visitas veterinarias.
    async createVisit(animalId: number, datos: VetVisitData, autorId: number): Promise<VetVisitDto> {
      comprobarDiaDeVisita(datos);
      return withTransaction(db, async (client) => {
        const a = await animalConZona(client, animalId);
        const id = await visitModel.create(client, animalId, datos, autorId);
        await crearTareaDeVisita(client, id, a, datos, autorId);
        return buscarVisita(client, id);
      });
    },

    getVisit: (id: number) => buscarVisita(db, id),

    /** Cambiarla de día u hora mueve su tarea. */
    async updateVisit(id: number, datos: VetVisitData, autorId: number): Promise<VetVisitDto> {
      return withTransaction(db, async (client) => {
        const visita = await buscarVisita(client, id, true);
        if (visita.status !== 'scheduled') throw new VetVisitNotScheduledError();
        comprobarDiaDeVisita(datos);
        const a = await animalConZona(client, visita.animalId);
        await visitModel.update(client, id, datos);
        await taskModel.deletePendingOfVisit(client, id);
        await crearTareaDeVisita(client, id, a, datos, autorId);
        return buscarVisita(client, id);
      });
    },

    async cancelVisit(id: number): Promise<VetVisitDto> {
      return withTransaction(db, async (client) => {
        const visita = await buscarVisita(client, id, true);
        if (visita.status !== 'scheduled') throw new VetVisitNotScheduledError();
        await visitModel.setStatus(client, id, 'cancelled');
        await taskModel.deletePendingOfVisit(client, id);
        return buscarVisita(client, id);
      });
    },

    /**
     * Registrarla: crea el registro del historial veterinario (CU-34) y
     * completa su tarea, en una sola transacción.
     */
    async completeVisit(user: SessionUser, id: number, registro: VetRecordData): Promise<VetVisitDto> {
      const problema = comprobarFechaRegistro(registro.recordDate, reloj.hoy());
      if (problema) throw enCampo('recordDate', MENSAJE_FECHA_REGISTRO[problema]);
      return withTransaction(db, async (client) => {
        const visita = await buscarVisita(client, id, true);
        const bloqueo = comprobarRegistroVisita(visita, reloj.hoy());
        if (bloqueo === 'NOT_SCHEDULED') throw new VetVisitNotScheduledError();
        if (bloqueo === 'FUTURE_DAY') throw new VetVisitFutureDayError();
        const registroId = await vetRecordModel.create(client, visita.animalId, registro, user.id);
        await visitModel.setStatus(client, id, 'done', registroId);
        if (visita.taskId !== null) {
          await taskModel.resolve(client, visita.taskId, {
            status: 'completed',
            resolvedBy: user.id,
            resolvedAt: reloj.ahora(),
            observations: null,
            photoUrl: null,
          });
        }
        return buscarVisita(client, id);
      });
    },
  };
}
