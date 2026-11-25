import { AGE_RANGES, ANIMAL_SEXES, type AgeRange, type AnimalSex } from '@sanctuary/shared';

// Ordenes que ofrece la interfaz del catálogo (CU-02). La API admite más.
export const CATALOG_UI_SORTS = ['-arrivalDate', 'name', 'adopterCount'] as const;
export type CatalogUiSort = (typeof CATALOG_UI_SORTS)[number];
const DEFAULT_SORT: CatalogUiSort = '-arrivalDate';

/** Estado de los filtros del catálogo, tal como se guarda en la URL. */
export interface CatalogFilters {
  q?: string;
  /** Una o varias especies (`speciesId=1,2` en la URL). */
  speciesIds?: number[];
  sex?: AnimalSex;
  /** Uno o varios tramos de edad (`age=young,senior`). */
  ages?: AgeRange[];
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

/** Lee una lista separada por comas; descarta los valores no válidos y los repetidos. */
function lista<T>(valor: string | null, convertir: (parte: string) => T | undefined): T[] {
  const valores: T[] = [];
  for (const parte of valor?.split(',') ?? []) {
    const convertido = convertir(parte.trim());
    if (convertido !== undefined && !valores.includes(convertido)) valores.push(convertido);
  }
  return valores;
}

const TRAMOS = Object.keys(AGE_RANGES) as AgeRange[];

/** Lee los filtros de la URL; los valores no válidos se ignoran. */
export function readCatalogFilters(params: URLSearchParams): CatalogFilters {
  const filtros: CatalogFilters = { sort: DEFAULT_SORT, page: 1 };
  const q = params.get('q')?.trim();
  if (q) filtros.q = q;
  const speciesIds = lista(params.get('speciesId'), enteroPositivo);
  if (speciesIds.length) filtros.speciesIds = speciesIds;
  const sex = params.get('sex');
  if (esUno(ANIMAL_SEXES, sex)) filtros.sex = sex;
  const ages = lista(params.get('age'), (parte) => (esUno(TRAMOS, parte) ? parte : undefined));
  if (ages.length) filtros.ages = ages;
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
  if (filtros.speciesIds?.length) params.set('speciesId', filtros.speciesIds.join(','));
  if (filtros.sex) params.set('sex', filtros.sex);
  if (filtros.ages?.length) params.set('age', filtros.ages.join(','));
  if (filtros.adoptable) params.set('adoptable', 'true');
  if (filtros.sort !== DEFAULT_SORT) params.set('sort', filtros.sort);
  if (filtros.page > 1) params.set('page', String(filtros.page));
  return params;
}

export type ApiQuery = Record<string, string | number | boolean | undefined>;

/** Parámetros de `GET /api/animals`: las especies y los tramos de edad, separados por comas. */
export function toApiQuery(filtros: CatalogFilters, pageSize: number): ApiQuery {
  const { speciesIds, ages, ...resto } = filtros;
  const query: ApiQuery = { ...resto, pageSize };
  if (speciesIds?.length) query.speciesId = speciesIds.join(',');
  if (ages?.length) query.age = ages.join(',');
  return query;
}

/** Número de filtros activos: cada especie y cada tramo cuentan (el orden y la página, no). */
export function countActiveFilters(filtros: CatalogFilters): number {
  const sueltos = [filtros.q, filtros.sex, filtros.adoptable].filter((f) => f !== undefined).length;
  return sueltos + (filtros.speciesIds?.length ?? 0) + (filtros.ages?.length ?? 0);
}
