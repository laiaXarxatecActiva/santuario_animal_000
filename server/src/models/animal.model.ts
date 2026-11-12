import {
  PUBLIC_ANIMAL_STATUSES,
  type AnimalSex,
  type AnimalStatus,
  type CatalogSort,
  type PhotoDto,
  type SpeciesSummary,
} from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

// Animal tal como lo ve la web pública. La edad la calcula el servicio con el Reloj.
export interface PublicAnimal {
  id: number;
  name: string;
  species: SpeciesSummary;
  breed: string | null;
  sex: AnimalSex;
  status: AnimalStatus;
  approxBirthDate: string | null;
  arrivalDate: string;
  rescueStory: string | null;
  temperament: string | null;
  specialNeeds: string | null;
  isAdoptable: boolean;
  adopterCount: number;
  coverPhoto: PhotoDto | null;
}

interface AnimalRow {
  id: number;
  name: string;
  species_id: number;
  species_name: string;
  species_scientific_name: string | null;
  breed: string | null;
  sex: AnimalSex;
  status: AnimalStatus;
  approx_birth_date: string | null;
  arrival_date: string;
  rescue_story: string | null;
  temperament: string | null;
  special_needs: string | null;
  is_adoptable: boolean;
  adopter_count: number;
  cover_id: number | null;
  cover_media_type: 'image' | 'video' | null;
  cover_url: string | null;
  cover_thumbnail_url: string | null;
  cover_alt_text: string | null;
}

export function mapRow(row: AnimalRow): PublicAnimal {
  return {
    id: row.id,
    name: row.name,
    species: { id: row.species_id, name: row.species_name, scientificName: row.species_scientific_name },
    breed: row.breed,
    sex: row.sex,
    status: row.status,
    approxBirthDate: row.approx_birth_date,
    arrivalDate: row.arrival_date,
    rescueStory: row.rescue_story,
    temperament: row.temperament,
    specialNeeds: row.special_needs,
    isAdoptable: row.is_adoptable,
    adopterCount: row.adopter_count,
    coverPhoto:
      row.cover_id === null || row.cover_url === null
        ? null
        : {
            id: row.cover_id,
            mediaType: row.cover_media_type ?? 'image',
            url: row.cover_url,
            thumbnailUrl: row.cover_thumbnail_url,
            altText: row.cover_alt_text ?? '',
          },
  };
}

// Solo animales publicados en el santuario o en tratamiento (RN-22). La
// portada solo se muestra si es pública. El número de adoptantes cuenta las
// adopciones activas (TECH_SPEC §8.5).
const SELECT_PUBLICO = `
  SELECT a.id, a.name, a.species_id, s.name AS species_name, s.scientific_name AS species_scientific_name,
         a.breed, a.sex, a.status, a.approx_birth_date, a.arrival_date, a.rescue_story, a.temperament,
         a.special_needs, a.is_adoptable, ac.adopter_count,
         cp.id AS cover_id, cp.media_type AS cover_media_type, cp.url AS cover_url,
         cp.thumbnail_url AS cover_thumbnail_url, cp.alt_text AS cover_alt_text
    FROM animals a
    JOIN species s ON s.id = a.species_id
    LEFT JOIN photos cp ON cp.id = a.cover_photo_id AND cp.visibility = 'public'
   CROSS JOIN LATERAL (
         SELECT count(*)::int AS adopter_count
           FROM adoptions ad
          WHERE ad.animal_id = a.id AND ad.status = 'active'
         ) ac`;

const CONDICION_PUBLICO = 'a.is_published AND a.status = ANY($1::varchar[])';

export interface CatalogFilters {
  speciesId?: number;
  sex?: AnimalSex;
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

  if (filtros.speciesId !== undefined) añadir((n) => `a.species_id = ${n}`, filtros.speciesId);
  if (filtros.sex !== undefined) añadir((n) => `a.sex = ${n}`, filtros.sex);
  if (filtros.bornOnOrBefore !== undefined) añadir((n) => `a.approx_birth_date <= ${n}::date`, filtros.bornOnOrBefore);
  if (filtros.bornAfter !== undefined) añadir((n) => `a.approx_birth_date > ${n}::date`, filtros.bornAfter);
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
