import { z } from 'zod';
import { AGE_RANGES, ANIMAL_SEXES, CATALOG_SORTS, type AgeRange } from '../constants/animals.js';
import { paginationQuerySchema } from './pagination.schema.js';

const edad = z.coerce.number().int().min(0).max(150);

const TRAMOS_DE_EDAD = Object.keys(AGE_RANGES) as AgeRange[];

/** Lista separada por comas («1,2»), sin repetidos y con al menos un valor. */
const listaPorComas = <T>(convertir: (parte: string) => T | undefined, mensaje: string) =>
  z.string().transform((texto, ctx) => {
    const valores: T[] = [];
    for (const parte of texto.split(',')) {
      const valor = convertir(parte.trim());
      if (valor === undefined) {
        ctx.addIssue({ code: 'custom', message: mensaje });
        return z.NEVER;
      }
      if (!valores.includes(valor)) valores.push(valor);
    }
    return valores;
  });

const idPositivo = (parte: string) => (/^[1-9]\d{0,9}$/.test(parte) ? Number(parte) : undefined);
const tramoDeEdad = (parte: string) => TRAMOS_DE_EDAD.find((tramo) => tramo === parte);

// Filtros, búsqueda y orden del catálogo (CU-02).
export const catalogQuerySchema = paginationQuerySchema
  .extend({
    sort: z.enum(CATALOG_SORTS).default('-arrivalDate'),
    /** Una o varias especies («1,2»). */
    speciesId: listaPorComas(idPositivo, 'Las especies deben ser identificadores separados por comas.').optional(),
    sex: z.enum(ANIMAL_SEXES).optional(),
    /** Uno o varios tramos de AGE_RANGES («young,senior»); se suman entre sí. */
    age: listaPorComas(tramoDeEdad, `Los tramos de edad válidos son: ${TRAMOS_DE_EDAD.join(', ')}.`).optional(),
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
