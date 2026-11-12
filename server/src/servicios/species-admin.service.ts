import type { SpeciesAdminDto } from '@sanctuary/shared';
import type { Pool } from 'pg';
import { withTransaction } from '../db/transaction.js';
import { NotFoundError, SpeciesInUseError } from '../errors/app-error.js';
import * as speciesModel from '../models/species.model.js';
import type { SpeciesData } from '../models/species.model.js';

export interface SpeciesAdminServiceDeps {
  db: Pool;
}

export type SpeciesAdminService = ReturnType<typeof createSpeciesAdminService>;

// CU-30 Gestionar especies.
export function createSpeciesAdminService({ db }: SpeciesAdminServiceDeps) {
  async function get(id: number): Promise<SpeciesAdminDto> {
    const especie = await speciesModel.findWithCount(db, id);
    if (!especie) throw new NotFoundError('Esta especie no existe.');
    return especie;
  }

  return {
    list: async () => ({ data: await speciesModel.listWithCounts(db) }),

    async create(datos: SpeciesData): Promise<SpeciesAdminDto> {
      return get(await speciesModel.create(db, datos));
    },

    async update(id: number, datos: SpeciesData): Promise<SpeciesAdminDto> {
      if (!(await speciesModel.update(db, id, datos))) throw new NotFoundError('Esta especie no existe.');
      return get(id);
    },

    /** A1: solo si ningún animal la usa (la FK `ON DELETE RESTRICT` también lo impide). */
    async remove(id: number): Promise<void> {
      await withTransaction(db, async (client) => {
        await client.query('SELECT 1 FROM species WHERE id = $1 FOR UPDATE', [id]);
        const especie = await speciesModel.findWithCount(client, id);
        if (!especie) throw new NotFoundError('Esta especie no existe.');
        if (especie.animalCount > 0) throw new SpeciesInUseError(especie.animalCount);
        await speciesModel.remove(client, id);
      });
    },
  };
}
