import type { VetRecordData, VetRecordDto } from '@sanctuary/shared';
import type { Pool } from 'pg';
import type { Reloj } from '../dominio/reloj.js';
import { comprobarFechaRegistro, MENSAJE_FECHA_REGISTRO } from '../dominio/veterinario.js';
import { NotFoundError, ValidationError } from '../errors/app-error.js';
import * as animalModel from '../models/animal-admin.model.js';
import * as vetModel from '../models/vet-record.model.js';

export interface VetRecordAdminServiceDeps {
  db: Pool;
  reloj: Reloj;
}

export type VetRecordAdminService = ReturnType<typeof createVetRecordAdminService>;

const animalNoExiste = () => new NotFoundError('Este animal no existe.');
const registroNoExiste = () => new NotFoundError('Este registro veterinario no existe.');

// CU-34 Gestionar el historial veterinario (cuidadores y administradores).
// Es interno: ninguna ruta pública ni del adoptante lo devuelve.
export function createVetRecordAdminService({ db, reloj }: VetRecordAdminServiceDeps) {
  /** 4a: la fecha no puede ser futura. */
  function comprobarFecha(datos: VetRecordData): void {
    const problema = comprobarFechaRegistro(datos.recordDate, reloj.hoy());
    if (problema) throw new ValidationError([{ field: 'recordDate', message: MENSAJE_FECHA_REGISTRO[problema] }]);
  }

  return {
    /** Paso 2: del más reciente al más antiguo. */
    async list(animalId: number): Promise<{ data: VetRecordDto[] }> {
      if (!(await animalModel.exists(db, animalId))) throw animalNoExiste();
      return { data: await vetModel.listByAnimal(db, animalId) };
    },

    async get(id: number): Promise<VetRecordDto> {
      const registro = await vetModel.findById(db, id);
      if (!registro) throw registroNoExiste();
      return registro;
    },

    /** Pasos 3-4. */
    async create(animalId: number, datos: VetRecordData, autorId: number): Promise<VetRecordDto> {
      comprobarFecha(datos);
      if (!(await animalModel.exists(db, animalId))) throw animalNoExiste();
      const id = await vetModel.create(db, animalId, datos, autorId);
      return (await vetModel.findById(db, id))!;
    },

    /** A1: cuidador o administrador. */
    async update(id: number, datos: VetRecordData): Promise<VetRecordDto> {
      comprobarFecha(datos);
      if (!(await vetModel.update(db, id, datos))) throw registroNoExiste();
      return (await vetModel.findById(db, id))!;
    },

    /** A2: solo el administrador (lo comprueba la ruta). */
    async remove(id: number): Promise<void> {
      if (!(await vetModel.remove(db, id))) throw registroNoExiste();
    },
  };
}
