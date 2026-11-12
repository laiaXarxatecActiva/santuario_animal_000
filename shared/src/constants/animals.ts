import type { AnimalStatus } from './status.js';

// Deben coincidir con el CHECK de animals.sex en seedsql.sql.
export const ANIMAL_SEXES = ['male', 'female', 'unknown'] as const;
export type AnimalSex = (typeof ANIMAL_SEXES)[number];

// Estados que se muestran en la web pública (RN-22): los fallecidos y los
// trasladados no aparecen en el catálogo.
export const PUBLIC_ANIMAL_STATUSES = ['in_sanctuary', 'in_treatment'] as const satisfies readonly AnimalStatus[];

// Rangos de edad del filtro del catálogo, en años cumplidos (CU-02).
export const AGE_RANGES = {
  young: { minAge: 0, maxAge: 4 },
  adult: { minAge: 5, maxAge: 15 },
  senior: { minAge: 16 },
} as const satisfies Record<string, { minAge: number; maxAge?: number }>;
export type AgeRange = keyof typeof AGE_RANGES;

// Campos por los que se puede ordenar el catálogo (lista blanca). El signo `-`
// indica orden descendente.
export const CATALOG_SORTS = ['-arrivalDate', 'arrivalDate', 'name', '-name', 'adopterCount', '-adopterCount'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

// Número máximo de animales destacados en la página de inicio (CU-01).
export const FEATURED_ANIMALS_LIMIT = 6;
