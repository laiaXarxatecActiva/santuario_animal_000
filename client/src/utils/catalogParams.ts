import { AGE_RANGES, ANIMAL_SEXES, type AgeRange, type AnimalSex } from '@sanctuary/shared';

// Ordenes que ofrece la interfaz del catálogo (CU-02). La API admite más.
export const CATALOG_UI_SORTS = ['-arrivalDate', 'name', 'adopterCount'] as const;
export type CatalogUiSort = (typeof CATALOG_UI_SORTS)[number];
const DEFAULT_SORT: CatalogUiSort = '-arrivalDate';

/** Estado de los filtros del catálogo, tal como se guarda en la URL. */
export interface CatalogFilters {
  q?: string;
  speciesId?: number;
  sex?: AnimalSex;
  age?: AgeRange;
  adoptable?: true;
  sort: CatalogUiSort;
  page: number;
}

const esUno = <T extends string>(valores: readonly T[], valor: string | null): valor is T =>
  valor !== null && (valores as readonly string[]).includes(valor);

function enteroPositivo(valor: string | null): number | undefined {
  if (valor === null || !/^\d+$/.test(valor)) return undefined;
  const n = Number(valor);
  return n > 0 ? n : undefined;
}

/** Lee los filtros de la URL; los valores no válidos se ignoran. */
export function readCatalogFilters(params: URLSearchParams): CatalogFilters {
  const filtros: CatalogFilters = { sort: DEFAULT_SORT, page: 1 };
  const q = params.get('q')?.trim();
  if (q) filtros.q = q;
  const speciesId = enteroPositivo(params.get('speciesId'));
  if (speciesId) filtros.speciesId = speciesId;
  const sex = params.get('sex');
  if (esUno(ANIMAL_SEXES, sex)) filtros.sex = sex;
  const age = params.get('age');
  if (esUno(Object.keys(AGE_RANGES) as AgeRange[], age)) filtros.age = age;
  if (params.get('adoptable') === 'true') filtros.adoptable = true;
  const sort = params.get('sort');
  if (esUno(CATALOG_UI_SORTS, sort)) filtros.sort = sort;
  filtros.page = enteroPositivo(params.get('page')) ?? 1;
  return filtros;
}

/** Escribe en la URL solo lo que no tiene el valor por defecto. */
export function writeCatalogFilters(filtros: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filtros.q) params.set('q', filtros.q);
  if (filtros.speciesId) params.set('speciesId', String(filtros.speciesId));
  if (filtros.sex) params.set('sex', filtros.sex);
  if (filtros.age) params.set('age', filtros.age);
  if (filtros.adoptable) params.set('adoptable', 'true');
  if (filtros.sort !== DEFAULT_SORT) params.set('sort', filtros.sort);
  if (filtros.page > 1) params.set('page', String(filtros.page));
  return params;
}

export type ApiQuery = Record<string, string | number | boolean | undefined>;

/** Parámetros de `GET /api/animals`: el rango de edad pasa a minAge/maxAge. */
export function toApiQuery(filtros: CatalogFilters, pageSize: number): ApiQuery {
  const { age, ...resto } = filtros;
  const query: ApiQuery = { ...resto, pageSize };
  if (age) Object.assign(query, AGE_RANGES[age]);
  return query;
}

/** Número de filtros activos (la búsqueda cuenta; el orden y la página, no). */
export function countActiveFilters(filtros: CatalogFilters): number {
  return [filtros.q, filtros.speciesId, filtros.sex, filtros.age, filtros.adoptable].filter((f) => f !== undefined)
    .length;
}
