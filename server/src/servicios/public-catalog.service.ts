import {
  FEATURED_ANIMALS_LIMIT,
  isWorkerRole,
  type AdoptionPlanDto,
  type AnimalCardDto,
  type AnimalUpdateDto,
  type CatalogQuery,
  type HomeDto,
  type Paginated,
  type PaginationQuery,
  type PublicAnimalDto,
  type SessionUser,
  type SpeciesSummary,
} from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { edadEnAnios, limitesDeNacimiento } from '../dominio/edad.js';
import { paginar, type Pagina } from '../dominio/paginacion.js';
import type { Reloj } from '../dominio/reloj.js';
import { AnimalNotAvailableError } from '../errors/app-error.js';
import * as adoptionModel from '../models/adoption.model.js';
import * as planModel from '../models/adoption-plan.model.js';
import * as animalModel from '../models/animal.model.js';
import * as updateModel from '../models/animal-update.model.js';
import * as photoModel from '../models/photo.model.js';
import * as speciesModel from '../models/species.model.js';

export interface PublicCatalogDeps {
  db: Queryable;
  reloj: Reloj;
}

const meta = ({ page, pageSize, total, totalPages }: Pagina) => ({ page, pageSize, total, totalPages });

// Casos de uso de la web pública: CU-01, CU-02, CU-03 y CU-04 (y la parte ampliada de CU-16).
export function createPublicCatalogService({ db, reloj }: PublicCatalogDeps) {
  const aTarjeta = (animal: animalModel.PublicAnimal, hoy: string): AnimalCardDto => ({
    id: animal.id,
    name: animal.name,
    species: animal.species,
    sex: animal.sex,
    status: animal.status,
    approxAgeYears: animal.approxBirthDate === null ? null : edadEnAnios(animal.approxBirthDate, hoy),
    isAdoptable: animal.isAdoptable,
    adopterCount: animal.adopterCount,
    coverPhoto: animal.coverPhoto,
  });

  /** Lanza AnimalNotAvailableError si el animal no se puede ver en la web pública. */
  async function animalPublico(id: number): Promise<animalModel.PublicAnimal> {
    const animal = await animalModel.findPublicById(db, id);
    if (!animal) throw new AnimalNotAvailableError();
    return animal;
  }

  /**
   * RN-15: ven el contenido exclusivo los trabajadores y los adoptantes con
   * una adopción activa del animal (TECH_SPEC §18.2: no las pausadas).
   */
  async function veExclusivo(user: SessionUser | undefined, animalId: number): Promise<boolean> {
    if (!user) return false;
    if (isWorkerRole(user.role)) return true;
    return adoptionModel.hasActive(db, user.id, animalId);
  }

  return {
    /** CU-01: destacados (adoptables con menos adoptantes) y número de animales acogidos. */
    async getHome(): Promise<HomeDto> {
      const hoy = reloj.hoy();
      const [shelteredCount, destacados] = await Promise.all([
        animalModel.countPublic(db),
        animalModel.listPublic(
          db,
          { adoptable: true },
          { sort: 'adopterCount', limit: FEATURED_ANIMALS_LIMIT, offset: 0 },
        ),
      ]);
      return { shelteredCount, featured: destacados.map((a) => aTarjeta(a, hoy)) };
    },

    /** CU-02: catálogo filtrado, ordenado y paginado. */
    async listCatalog(query: CatalogQuery): Promise<Paginated<AnimalCardDto>> {
      const hoy = reloj.hoy();
      const limites = limitesDeNacimiento(query, hoy);
      const filtros: animalModel.CatalogFilters = {
        speciesId: query.speciesId,
        sex: query.sex,
        bornOnOrBefore: limites.nacidoComoTarde,
        bornAfter: limites.nacidoDespuesDe,
        adoptable: query.adoptable,
        q: query.q,
      };
      const pagina = paginar(query, await animalModel.countPublic(db, filtros));
      const animales =
        pagina.total === 0
          ? []
          : await animalModel.listPublic(db, filtros, {
              sort: query.sort,
              limit: pagina.pageSize,
              offset: pagina.offset,
            });
      return { data: animales.map((a) => aTarjeta(a, hoy)), meta: meta(pagina) };
    },

    /**
     * CU-03: ficha pública con galería y adoptantes que aceptan aparecer.
     * CU-16: con acceso exclusivo, añade el resumen de salud y las fotos `adopters`.
     */
    async getAnimal(id: number, user?: SessionUser): Promise<PublicAnimalDto> {
      const animal = await animalPublico(id);
      const exclusiveAccess = await veExclusivo(user, id);
      const [photos, publicAdopterNames] = await Promise.all([
        photoModel.listGallery(db, id, { includeAdopters: exclusiveAccess }),
        adoptionModel.listPublicAdopterNames(db, id),
      ]);
      return {
        ...aTarjeta(animal, reloj.hoy()),
        breed: animal.breed,
        approxBirthDate: animal.approxBirthDate,
        arrivalDate: animal.arrivalDate,
        rescueStory: animal.rescueStory,
        temperament: animal.temperament,
        specialNeeds: animal.specialNeeds,
        publicAdopterNames,
        photos,
        exclusiveAccess,
        ...(exclusiveAccess ? { healthSummary: animal.healthSummary } : {}),
      };
    },

    /**
     * CU-03: últimas actualizaciones públicas del animal. CU-16: con acceso
     * exclusivo, todas; a los adoptantes se les indica cuáles han leído.
     */
    async listUpdates(
      animalId: number,
      query: PaginationQuery,
      user?: SessionUser,
    ): Promise<Paginated<AnimalUpdateDto>> {
      await animalPublico(animalId);
      const includeAdopters = await veExclusivo(user, animalId);
      const readerId = includeAdopters && user?.role === 'adopter' ? user.id : undefined;
      const pagina = paginar(query, await updateModel.countByAnimal(db, animalId, { includeAdopters }));
      const actualizaciones =
        pagina.total === 0
          ? []
          : await updateModel.listByAnimal(db, animalId, {
              includeAdopters,
              readerId,
              limit: pagina.pageSize,
              offset: pagina.offset,
            });
      const fotos = await photoModel.listByUpdates(
        db,
        actualizaciones.map((u) => u.id),
        { includeAdopters },
      );
      return {
        data: actualizaciones.map((u) => ({ ...u, photos: fotos.get(u.id) ?? [] })),
        meta: meta(pagina),
      };
    },

    /** Especies para los filtros del catálogo (CU-02). */
    listSpecies(): Promise<SpeciesSummary[]> {
      return speciesModel.listAll(db);
    },

    /** Planes activos (CU-04). */
    listPlans(): Promise<AdoptionPlanDto[]> {
      return planModel.listActive(db);
    },
  };
}

export type PublicCatalogService = ReturnType<typeof createPublicCatalogService>;
