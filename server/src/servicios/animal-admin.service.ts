import type { AdminAnimalDto, AdminAnimalsQuery, AnimalData, AnimalStatusBody, Paginated } from '@sanctuary/shared';
import type { Pool } from 'pg';
import type { Queryable } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import {
  motivoDeCierre,
  puedeCambiarDeEstado,
  puedeSerAdoptable,
  sePuedeBorrar,
  estaArchivado,
} from '../dominio/animal.js';
import { paginar } from '../dominio/paginacion.js';
import type { Reloj } from '../dominio/reloj.js';
import {
  AnimalArchivedError,
  AnimalHasAdoptionsError,
  ArchivedAnimalNotAdoptableError,
  FieldRuleError,
  NotFoundError,
} from '../errors/app-error.js';
import * as animalModel from '../models/animal-admin.model.js';
import * as adoptionModel from '../models/adoption.model.js';
import * as speciesModel from '../models/species.model.js';

export interface AnimalAdminServiceDeps {
  db: Pool;
  reloj: Reloj;
}

export type AnimalAdminService = ReturnType<typeof createAnimalAdminService>;

const noExiste = () => new NotFoundError('Este animal no existe.');

// CU-28 Gestionar animales (el cambio a fallecido o trasladado cierra las
// adopciones como en CU-33 5.1-5.2; los mensajes y avisos llegan en la fase 2).
export function createAnimalAdminService({ db, reloj }: AnimalAdminServiceDeps) {
  async function buscar(q: Queryable, id: number, forUpdate = false): Promise<AdminAnimalDto> {
    const animal = await animalModel.findById(q, id, { forUpdate });
    if (!animal) throw noExiste();
    return animal;
  }

  /** Comprobaciones que no puede hacer el esquema: la especie existe y la llegada no es futura. */
  async function validar(q: Queryable, datos: AnimalData): Promise<void> {
    if (datos.arrivalDate > reloj.hoy()) {
      throw new FieldRuleError('ARRIVAL_IN_FUTURE', 'arrivalDate', 'La fecha de llegada no puede ser futura.');
    }
    if (!(await speciesModel.exists(q, datos.speciesId))) {
      throw new FieldRuleError('SPECIES_NOT_FOUND', 'speciesId', 'Esta especie no existe.');
    }
  }

  return {
    async list(query: AdminAnimalsQuery): Promise<Paginated<AdminAnimalDto>> {
      const filtros = {
        q: query.q,
        speciesId: query.speciesId,
        status: query.status,
        published: query.published,
        adoptable: query.adoptable,
      };
      const total = await animalModel.count(db, filtros);
      const pagina = paginar(query, total);
      const data =
        total === 0
          ? []
          : await animalModel.list(db, filtros, { sort: query.sort, limit: pagina.pageSize, offset: pagina.offset });
      return {
        data,
        meta: { page: pagina.page, pageSize: pagina.pageSize, total: pagina.total, totalPages: pagina.totalPages },
      };
    },

    get: (id: number) => buscar(db, id),

    /** Alta (pasos 1-3): empieza en el santuario. */
    async create(datos: AnimalData): Promise<AdminAnimalDto> {
      await validar(db, datos);
      return buscar(db, await animalModel.create(db, datos));
    },

    /** Edición (pasos 2-3), A1 publicar u ocultar y 2b. */
    async update(id: number, datos: AnimalData): Promise<AdminAnimalDto> {
      return withTransaction(db, async (client) => {
        const actual = await buscar(client, id, true);
        await validar(client, datos);
        if (!puedeSerAdoptable(actual.status, datos.isAdoptable)) throw new ArchivedAnimalNotAdoptableError();
        await animalModel.update(client, id, datos);
        return buscar(client, id);
      });
    },

    /** A2 (directo) y A3: fallecido o trasladado archiva el animal y cierra sus adopciones abiertas. */
    async changeStatus(id: number, cambio: AnimalStatusBody): Promise<AdminAnimalDto> {
      const hoy = reloj.hoy();
      const fecha = cambio.date ?? hoy;
      if (fecha > hoy) throw new FieldRuleError('DATE_IN_FUTURE', 'date', 'La fecha no puede ser futura.');
      return withTransaction(db, async (client) => {
        const actual = await buscar(client, id, true);
        if (!puedeCambiarDeEstado(actual.status)) throw new AnimalArchivedError();
        const archivar = estaArchivado(cambio.status);
        await animalModel.updateStatus(client, id, {
          status: cambio.status,
          statusChangedAt: archivar ? fecha : null,
          archivar,
        });
        const motivo = motivoDeCierre(cambio.status);
        if (motivo) await adoptionModel.closeOpenForAnimal(client, id, { reason: motivo, date: fecha });
        return buscar(client, id);
      });
    },

    /** A4 (solo administrador): sin historial de adopciones (RN-17). */
    async remove(id: number): Promise<void> {
      await withTransaction(db, async (client) => {
        const actual = await buscar(client, id, true);
        if (!sePuedeBorrar(actual.hasAdoptionHistory)) throw new AnimalHasAdoptionsError();
        await animalModel.remove(client, id);
      });
    },
  };
}
