import type { HandoverNoteData, HandoverNoteDto, SessionUser } from '@sanctuary/shared';
import type { Pool } from 'pg';
import type { Reloj } from '../dominio/reloj.js';
import { desdeDelRelevo, puedeEscribirRelevo, zonasDelRelevo } from '../dominio/relevo.js';
import { NotFoundError, ValidationError } from '../errors/app-error.js';
import * as noteModel from '../models/handover-note.model.js';
import * as assignmentModel from '../models/shift-assignment.model.js';
import * as zoneModel from '../models/zone.model.js';

export interface HandoverServiceDeps {
  db: Pool;
  reloj: Reloj;
}

export type HandoverService = ReturnType<typeof createHandoverService>;

const noExiste = () => new NotFoundError('Esta nota de relevo no existe.');

// CU-71: notas de relevo por zona.
export function createHandoverService({ db, reloj }: HandoverServiceDeps) {
  /** Las zonas de los turnos de hoy de una persona. */
  async function zonasDeMiTurno(userId: number): Promise<number[]> {
    const hoy = reloj.hoy();
    const turnos = await assignmentModel.listOfUser(db, userId, hoy, hoy);
    return turnos.flatMap((t) => t.zones.map((z) => z.id));
  }

  return {
    async list(user: SessionUser): Promise<{ data: HandoverNoteDto[] }> {
      const todas = (await zoneModel.list(db)).map((z) => z.id);
      const zonas = zonasDelRelevo(user.role, await zonasDeMiTurno(user.id), todas);
      return { data: await noteModel.listForZones(db, user.id, zonas, desdeDelRelevo(reloj.ahora())) };
    },

    async create(user: SessionUser, datos: HandoverNoteData): Promise<HandoverNoteDto> {
      if (!(await zoneModel.isActive(db, datos.zoneId))) {
        throw new ValidationError([{ field: 'zoneId', message: 'Esta zona no existe o está desactivada.' }]);
      }
      if (!puedeEscribirRelevo(user.role, await zonasDeMiTurno(user.id), datos.zoneId)) {
        throw new ValidationError([{ field: 'zoneId', message: 'No tienes turno hoy en esta zona.' }]);
      }
      const id = await noteModel.create(db, {
        zoneId: datos.zoneId,
        authorId: user.id,
        body: datos.body,
        createdAt: reloj.ahora(),
      });
      return (await noteModel.findById(db, user.id, id))!;
    },

    async markRead(user: SessionUser, id: number): Promise<HandoverNoteDto> {
      if (!(await noteModel.findById(db, user.id, id))) throw noExiste();
      await noteModel.markRead(db, id, user.id, reloj.ahora());
      return (await noteModel.findById(db, user.id, id))!;
    },
  };
}
