import type {
  NamedRef,
  QualificationData,
  QualificationDto,
  UserQualificationsDto,
  ZoneData,
  ZoneDto,
} from '@sanctuary/shared';
import { isWorkerRole } from '@sanctuary/shared';
import type { Pool } from 'pg';
import { withTransaction } from '../db/transaction.js';
import { NotFoundError, ValidationError } from '../errors/app-error.js';
import * as qualificationModel from '../models/qualification.model.js';
import * as userModel from '../models/user.model.js';
import * as zoneModel from '../models/zone.model.js';

export interface ZoneAdminServiceDeps {
  db: Pool;
}

export type ZoneAdminService = ReturnType<typeof createZoneAdminService>;

const zonaNoExiste = () => new NotFoundError('Esta zona no existe.');
const cualificacionNoExiste = () => new NotFoundError('Esta cualificación no existe.');
const trabajadorNoExiste = () => new NotFoundError('Este trabajador no existe.');

// CU-52 Gestionar zonas y CU-53 Gestionar cualificaciones (escritura: solo administradores).
export function createZoneAdminService({ db }: ZoneAdminServiceDeps) {
  async function trabajador(userId: number): Promise<void> {
    const user = await userModel.findById(db, userId);
    if (!user || !isWorkerRole(user.role)) throw trabajadorNoExiste();
  }

  return {
    async listZones(): Promise<{ data: ZoneDto[] }> {
      return { data: await zoneModel.list(db) };
    },

    async getZone(id: number): Promise<ZoneDto> {
      const zona = await zoneModel.findById(db, id);
      if (!zona) throw zonaNoExiste();
      return zona;
    },

    async createZone(datos: ZoneData): Promise<ZoneDto> {
      return (await zoneModel.findById(db, await zoneModel.create(db, datos)))!;
    },

    async updateZone(id: number, datos: ZoneData): Promise<ZoneDto> {
      if (!(await zoneModel.update(db, id, datos))) throw zonaNoExiste();
      return (await zoneModel.findById(db, id))!;
    },

    /** A1: solo si nada la usa; si no, se desactiva. */
    async removeZone(id: number): Promise<void> {
      if (!(await zoneModel.remove(db, id))) throw zonaNoExiste();
    },

    async listQualifications(): Promise<{ data: QualificationDto[] }> {
      return { data: await qualificationModel.list(db) };
    },

    async getQualification(id: number): Promise<QualificationDto> {
      const cualificacion = await qualificationModel.findById(db, id);
      if (!cualificacion) throw cualificacionNoExiste();
      return cualificacion;
    },

    async createQualification(datos: QualificationData): Promise<QualificationDto> {
      return (await qualificationModel.findById(db, await qualificationModel.create(db, datos)))!;
    },

    async updateQualification(id: number, datos: QualificationData): Promise<QualificationDto> {
      if (!(await qualificationModel.update(db, id, datos))) throw cualificacionNoExiste();
      return (await qualificationModel.findById(db, id))!;
    },

    async removeQualification(id: number): Promise<void> {
      if (!(await qualificationModel.remove(db, id))) throw cualificacionNoExiste();
    },

    /** CU-53 paso 3. Un adoptante no es trabajador: 404. */
    async getOfUser(userId: number): Promise<UserQualificationsDto> {
      await trabajador(userId);
      return { userId, qualifications: await qualificationModel.listOfUser(db, userId) };
    },

    async setOfUser(userId: number, ids: readonly number[]): Promise<UserQualificationsDto & { before: NamedRef[] }> {
      await trabajador(userId);
      if ((await qualificationModel.missing(db, ids)).length > 0) {
        throw new ValidationError([{ field: 'qualificationIds', message: 'Esta cualificación no existe.' }]);
      }
      return withTransaction(db, async (client) => {
        const before = await qualificationModel.listOfUser(client, userId);
        await qualificationModel.replaceOfUser(client, userId, ids);
        return { userId, qualifications: await qualificationModel.listOfUser(client, userId), before };
      });
    },
  };
}
