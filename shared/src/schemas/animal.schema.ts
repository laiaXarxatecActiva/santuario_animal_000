import { z } from 'zod';
import { ANIMAL_SEXES, CATALOG_SORTS } from '../constants/animals.js';
import { paginationQuerySchema } from './pagination.schema.js';

const edad = z.coerce.number().int().min(0).max(150);

// Filtros, búsqueda y orden del catálogo (CU-02).
export const catalogQuerySchema = paginationQuerySchema
  .extend({
    sort: z.enum(CATALOG_SORTS).default('-arrivalDate'),
    speciesId: z.coerce.number().int().positive().optional(),
    sex: z.enum(ANIMAL_SEXES).optional(),
    minAge: edad.optional(),
    maxAge: edad.optional(),
    adoptable: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .optional(),
    q: z
      .string()
      .trim()
      .max(100)
      .transform((texto) => (texto === '' ? undefined : texto))
      .optional(),
  })
  .refine((query) => query.minAge === undefined || query.maxAge === undefined || query.minAge <= query.maxAge, {
    path: ['maxAge'],
    message: 'La edad máxima no puede ser menor que la mínima.',
  });
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
