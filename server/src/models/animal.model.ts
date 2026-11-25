import {
  PUBLIC_ANIMAL_STATUSES,
  type AnimalSex,
  type AnimalStatus,
  type CatalogSort,
  type PhotoDto,
  type SpeciesSummary,
} from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { COLUMNAS_PORTADA, JOIN_PORTADA, mapCover, type CoverRow } from './photo.model.js';

// Animal tal como lo ve la web pública. La edad la calcula el servicio con el Reloj.
export interface PublicAnimal {
  id: number;
  name: string;
  species: SpeciesSummary;
  sex: AnimalSex;
  status: AnimalStatus;
  approxBirthDate: string | null;
  arrivalDate: string;
  rescueStory: string | null;
  temperament: string | null;
  specialNeeds: string | null;
  /** Solo para adoptantes activos y trabajadores (RN-15): el servicio decide si se muestra. */
  healthSummary: string | null;
  isAdoptable: boolean;
  adopterCount: number;
  coverPhoto: PhotoDto | null;
}

interface AnimalRow extends CoverRow {
  id: number;
  name: string;
  species_id: number;
  species_name: string;
  species_scientific_name: string | null;
  sex: AnimalSex;
  status: AnimalStatus;
  approx_birth_date: string | null;
  arrival_date: string;
  rescue_story: string | null;
  temperament: string | null;
  special_needs: string | null;
  health_summary: string | null;
  is_adoptable: boolean;
  adopter_count: number;
}

export function mapRow(row: AnimalRow): PublicAnimal {
  return {
    id: row.id,
    name: row.name,
    species: { id: row.species_id, name: row.species_name, scientificName: row.species_scientific_name },
    sex: row.sex,
    status: row.status,
    approxBirthDate: row.approx_birth_date,
    arrivalDate: row.arrival_date,
    rescueStory: row.rescue_story,
    temperament: row.temperament,
    specialNeeds: row.special_needs,
    healthSummary: row.health_summary,
    isAdoptable: row.is_adoptable,
    adopterCount: row.adopter_count,
    coverPhoto: mapCover(row),
  };
}

// Solo animales publicados en el santuario o en tratamiento (RN-22). La
// portada solo se muestra si es pública. El número de adoptantes cuenta las
// adopciones activas (TECH_SPEC §8.5).
const SELECT_PUBLICO = `
  SELECT a.id, a.name, a.species_id, s.name AS species_name, s.scientific_name AS species_scientific_name,
         a.sex, a.status, a.approx_birth_date, a.arrival_date, a.rescue_story, a.temperament,
         a.special_needs, a.health_summary, a.is_adoptable, ac.adopter_count,
         ${COLUMNAS_PORTADA}
    FROM animals a
    JOIN species s ON s.id = a.species_id
    ${JOIN_PORTADA('a')}
   CROSS JOIN LATERAL (
         SELECT count(*)::int AS adopter_count
           FROM adoptions ad
          WHERE ad.animal_id = a.id AND ad.status = 'active'
         ) ac`;

const CONDICION_PUBLICO = 'a.is_published AND a.status = ANY($1::varchar[])';

/** Límites de fecha de nacimiento de un tramo de edad. */
export interface BirthBounds {
  /** Nacido en esta fecha o antes (edad mínima). */
  bornOnOrBefore?: string;
  /** Nacido después de esta fecha (edad máxima). */
  bornAfter?: string;
}

export interface CatalogFilters {
  /** Una o varias especies (basta con que sea de una). */
  speciesIds?: number[];
  sex?: AnimalSex;
  /** Tramos de edad: basta con estar en uno de ellos. */
  ageRanges?: BirthBounds[];
  /** Nacido en esta fecha o antes (edad mínima). */
  bornOnOrBefore?: string;
  /** Nacido después de esta fecha (edad máxima). */
  bornAfter?: string;
  adoptable?: boolean;
  q?: string;
}

// Quita mayúsculas y tildes para buscar «ebano» y encontrar «Ébano».
const sinTildes = (expr: string) => `translate(lower(${expr}), 'áàâäéèêëíìîïóòôöúùûüñç', 'aaaaeeeeiiiioooouuuunc')`;

function construirFiltro(filtros: CatalogFilters): { where: string; params: unknown[] } {
  const params: unknown[] = [PUBLIC_ANIMAL_STATUSES];
  const condiciones = [CONDICION_PUBLICO];
  const añadir = (sql: (n: string) => string, valor: unknown) => {
    params.push(valor);
    condiciones.push(sql(`$${params.length}`));
  };

  if (filtros.speciesIds?.length) añadir((n) => `a.species_id = ANY(${n}::int[])`, filtros.speciesIds);
  if (filtros.sex !== undefined) añadir((n) => `a.sex = ${n}`, filtros.sex);
  if (filtros.bornOnOrBefore !== undefined) añadir((n) => `a.approx_birth_date <= ${n}::date`, filtros.bornOnOrBefore);
  if (filtros.bornAfter !== undefined) añadir((n) => `a.approx_birth_date > ${n}::date`, filtros.bornAfter);
  if (filtros.ageRanges?.length) {
    const tramos = filtros.ageRanges.map((tramo) => {
      const partes: string[] = [];
      const parametro = (valor: string) => {
        params.push(valor);
        return `$${params.length}::date`;
      };
      if (tramo.bornOnOrBefore !== undefined) partes.push(`a.approx_birth_date <= ${parametro(tramo.bornOnOrBefore)}`);
      if (tramo.bornAfter !== undefined) partes.push(`a.approx_birth_date > ${parametro(tramo.bornAfter)}`);
      // Un tramo sin límites (no debería darse) admite cualquier fecha conocida.
      return partes.length ? `(${partes.join(' AND ')})` : '(a.approx_birth_date IS NOT NULL)';
    });
    condiciones.push(`(${tramos.join(' OR ')})`);
  }
  if (filtros.adoptable !== undefined) añadir((n) => `a.is_adoptable = ${n}`, filtros.adoptable);
  if (filtros.q !== undefined) {
    const patron = filtros.q.replace(/[\\%_]/g, '\\$&');
    añadir((n) => `${sinTildes('a.name')} LIKE '%' || ${sinTildes(n)} || '%'`, patron);
  }

  return { where: condiciones.join(' AND '), params };
}

// Lista blanca: cada orden permitido se traduce a un ORDER BY fijo.
const ORDEN: Record<CatalogSort, string> = {
  '-arrivalDate': 'a.arrival_date DESC, a.id DESC',
  arrivalDate: 'a.arrival_date ASC, a.id ASC',
  name: 'a.name ASC, a.id ASC',
  '-name': 'a.name DESC, a.id DESC',
  adopterCount: 'ac.adopter_count ASC, a.arrival_date DESC, a.id DESC',
  '-adopterCount': 'ac.adopter_count DESC, a.arrival_date DESC, a.id DESC',
};

export async function countPublic(db: Queryable, filtros: CatalogFilters = {}): Promise<number> {
  const { where, params } = construirFiltro(filtros);
  const { rows } = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM animals a WHERE ${where}`,
    params,
  );
  return rows[0]?.total ?? 0;
}

export async function listPublic(
  db: Queryable,
  filtros: CatalogFilters,
  opciones: { sort: CatalogSort; limit: number; offset: number },
): Promise<PublicAnimal[]> {
  const { where, params } = construirFiltro(filtros);
  params.push(opciones.limit, opciones.offset);
  const { rows } = await db.query<AnimalRow>(
    `${SELECT_PUBLICO}
      WHERE ${where}
      ORDER BY ${ORDEN[opciones.sort]}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows.map(mapRow);
}

export async function findPublicById(db: Queryable, id: number): Promise<PublicAnimal | null> {
  const { rows } = await db.query<AnimalRow>(`${SELECT_PUBLICO} WHERE ${CONDICION_PUBLICO} AND a.id = $2`, [
    PUBLIC_ANIMAL_STATUSES,
    id,
  ]);
  const row = rows[0];
  return row ? mapRow(row) : null;
}

// --- CU-12 «En memoria» ---

export interface MemorialAnimal {
  id: number;
  name: string;
  species: SpeciesSummary;
  sex: AnimalSex;
  arrivalDate: string;
  deathDate: string | null;
  rescueStory: string | null;
  coverPhoto: PhotoDto | null;
}

interface MemorialRow extends CoverRow {
  id: number;
  name: string;
  species_id: number;
  species_name: string;
  species_scientific_name: string | null;
  sex: AnimalSex;
  arrival_date: string;
  status_changed_at: string | null;
  rescue_story: string | null;
}

/** Fallecidos marcados para «En memoria», del fallecimiento más reciente al más antiguo. */
export async function listMemorial(db: Queryable): Promise<MemorialAnimal[]> {
  const { rows } = await db.query<MemorialRow>(
    `SELECT a.id, a.name, a.species_id, s.name AS species_name, s.scientific_name AS species_scientific_name,
            a.sex, a.arrival_date, a.status_changed_at, a.rescue_story,
            ${COLUMNAS_PORTADA}
       FROM animals a
       JOIN species s ON s.id = a.species_id
       ${JOIN_PORTADA('a')}
      WHERE a.show_in_memorial AND a.status = 'deceased'
      ORDER BY a.status_changed_at DESC NULLS LAST, a.id`,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    species: { id: row.species_id, name: row.species_name, scientificName: row.species_scientific_name },
    sex: row.sex,
    arrivalDate: row.arrival_date,
    deathDate: row.status_changed_at,
    rescueStory: row.rescue_story,
    coverPhoto: mapCover(row),
  }));
}
