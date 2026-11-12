import type { AdminAnimalDto, AdminAnimalSort, AnimalData, AnimalSex, AnimalStatus } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { esErrorPg, PG_CHECK_VIOLATION } from '../db/pg-errors.js';
import { ArchivedAnimalNotAdoptableError, FieldRuleError } from '../errors/app-error.js';
import { COLUMNAS_PORTADA, JOIN_PORTADA, mapCover, type CoverRow } from './photo.model.js';

// Animales tal como los ve el panel (CU-28): todos, también ocultos y archivados.

interface AnimalAdminRow extends CoverRow {
  id: number;
  name: string;
  species_id: number;
  species_name: string;
  breed: string | null;
  sex: AnimalSex;
  approx_birth_date: string | null;
  arrival_date: string;
  rescue_story: string | null;
  temperament: string | null;
  special_needs: string | null;
  health_summary: string | null;
  status: AnimalStatus;
  status_changed_at: string | null;
  is_adoptable: boolean;
  is_published: boolean;
  active_adopters: number;
  open_adoptions: number;
  has_adoption_history: boolean;
}

export function mapRow(row: AnimalAdminRow): AdminAnimalDto {
  return {
    id: row.id,
    name: row.name,
    species: { id: row.species_id, name: row.species_name },
    breed: row.breed,
    sex: row.sex,
    approxBirthDate: row.approx_birth_date,
    arrivalDate: row.arrival_date,
    rescueStory: row.rescue_story,
    temperament: row.temperament,
    specialNeeds: row.special_needs,
    healthSummary: row.health_summary,
    status: row.status,
    statusChangedAt: row.status_changed_at,
    isAdoptable: row.is_adoptable,
    isPublished: row.is_published,
    activeAdopters: row.active_adopters,
    openAdoptions: row.open_adoptions,
    hasAdoptionHistory: row.has_adoption_history,
    // En el panel se ve la portada aunque sea «solo adoptantes».
    coverPhoto: mapCover(row),
  };
}

const SELECT = `
  SELECT a.id, a.name, a.species_id, s.name AS species_name, a.breed, a.sex,
         a.approx_birth_date, a.arrival_date, a.rescue_story, a.temperament, a.special_needs,
         a.health_summary, a.status, a.status_changed_at, a.is_adoptable, a.is_published,
         ad.active_adopters, ad.open_adoptions, ad.has_adoption_history,
         ${COLUMNAS_PORTADA}
    FROM animals a
    JOIN species s ON s.id = a.species_id
    ${JOIN_PORTADA('a')}
   CROSS JOIN LATERAL (
         SELECT count(*) FILTER (WHERE x.status = 'active')::int AS active_adopters,
                count(*) FILTER (WHERE x.status IN ('pending', 'active', 'paused'))::int AS open_adoptions,
                count(*) > 0 AS has_adoption_history
           FROM adoptions x
          WHERE x.animal_id = a.id
         ) ad`;

export interface AdminAnimalFilters {
  q?: string;
  speciesId?: number;
  status?: AnimalStatus;
  published?: boolean;
  adoptable?: boolean;
}

// Quita mayúsculas y tildes para buscar «ebano» y encontrar «Ébano».
const sinTildes = (expr: string) => `translate(lower(${expr}), 'áàâäéèêëíìîïóòôöúùûüñç', 'aaaaeeeeiiiioooouuuunc')`;

function construirFiltro(filtros: AdminAnimalFilters): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  const condiciones = ['TRUE'];
  const añadir = (sql: (n: string) => string, valor: unknown) => {
    params.push(valor);
    condiciones.push(sql(`$${params.length}`));
  };
  if (filtros.speciesId !== undefined) añadir((n) => `a.species_id = ${n}`, filtros.speciesId);
  if (filtros.status !== undefined) añadir((n) => `a.status = ${n}`, filtros.status);
  if (filtros.published !== undefined) añadir((n) => `a.is_published = ${n}`, filtros.published);
  if (filtros.adoptable !== undefined) añadir((n) => `a.is_adoptable = ${n}`, filtros.adoptable);
  if (filtros.q !== undefined) {
    const patron = filtros.q.replace(/[\\%_]/g, '\\$&');
    añadir((n) => `${sinTildes('a.name')} LIKE '%' || ${sinTildes(n)} || '%'`, patron);
  }
  return { where: condiciones.join(' AND '), params };
}

// Lista blanca de órdenes.
const ORDEN: Record<AdminAnimalSort, string> = {
  name: 'a.name ASC, a.id ASC',
  '-name': 'a.name DESC, a.id DESC',
  arrivalDate: 'a.arrival_date ASC, a.id ASC',
  '-arrivalDate': 'a.arrival_date DESC, a.id DESC',
};

export async function count(db: Queryable, filtros: AdminAnimalFilters): Promise<number> {
  const { where, params } = construirFiltro(filtros);
  const { rows } = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM animals a WHERE ${where}`,
    params,
  );
  return rows[0]?.total ?? 0;
}

export async function list(
  db: Queryable,
  filtros: AdminAnimalFilters,
  opciones: { sort: AdminAnimalSort; limit: number; offset: number },
): Promise<AdminAnimalDto[]> {
  const { where, params } = construirFiltro(filtros);
  params.push(opciones.limit, opciones.offset);
  const { rows } = await db.query<AnimalAdminRow>(
    `${SELECT} WHERE ${where} ORDER BY ${ORDEN[opciones.sort]}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows.map(mapRow);
}

export async function findById(
  db: Queryable,
  id: number,
  opciones: { forUpdate?: boolean } = {},
): Promise<AdminAnimalDto | null> {
  if (opciones.forUpdate) await db.query('SELECT 1 FROM animals WHERE id = $1 FOR UPDATE', [id]);
  const { rows } = await db.query<AnimalAdminRow>(`${SELECT} WHERE a.id = $1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Traduce los CHECK de `animals` a errores en el campo (las reglas también están en el dominio). */
function traducirError(error: unknown): never {
  if (esErrorPg(error, PG_CHECK_VIOLATION, 'animals_archived_not_adoptable'))
    throw new ArchivedAnimalNotAdoptableError();
  if (esErrorPg(error, PG_CHECK_VIOLATION, 'animals_birth_before_arrival')) {
    throw new FieldRuleError(
      'BIRTH_AFTER_ARRIVAL',
      'approxBirthDate',
      'La fecha de nacimiento no puede ser posterior a la de llegada.',
    );
  }
  throw error;
}

const COLUMNAS = [
  'name',
  'species_id',
  'breed',
  'sex',
  'approx_birth_date',
  'arrival_date',
  'rescue_story',
  'temperament',
  'special_needs',
  'health_summary',
  'is_adoptable',
  'is_published',
] as const;

const valores = (d: AnimalData) => [
  d.name,
  d.speciesId,
  d.breed,
  d.sex,
  d.approxBirthDate,
  d.arrivalDate,
  d.rescueStory,
  d.temperament,
  d.specialNeeds,
  d.healthSummary,
  d.isAdoptable,
  d.isPublished,
];

export async function create(db: Queryable, datos: AnimalData): Promise<number> {
  try {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO animals (${COLUMNAS.join(', ')})
       VALUES (${COLUMNAS.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      valores(datos),
    );
    return rows[0]!.id;
  } catch (error) {
    traducirError(error);
  }
}

export async function update(db: Queryable, id: number, datos: AnimalData): Promise<void> {
  try {
    await db.query(`UPDATE animals SET ${COLUMNAS.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1`, [
      id,
      ...valores(datos),
    ]);
  } catch (error) {
    traducirError(error);
  }
}

/** A2-A3. Al archivarlo deja de ser adoptable (CU-33 5.1). */
export async function updateStatus(
  db: Queryable,
  id: number,
  cambio: { status: AnimalStatus; statusChangedAt: string | null; archivar: boolean },
): Promise<void> {
  await db.query(
    `UPDATE animals
        SET status = $2, status_changed_at = $3,
            is_adoptable = CASE WHEN $4 THEN FALSE ELSE is_adoptable END
      WHERE id = $1`,
    [id, cambio.status, cambio.statusChangedAt, cambio.archivar],
  );
}

/** A4: borra el animal; sus fotos, actualizaciones y lecturas caen en cascada. */
export async function remove(db: Queryable, id: number): Promise<void> {
  await db.query('DELETE FROM animals WHERE id = $1', [id]);
}
