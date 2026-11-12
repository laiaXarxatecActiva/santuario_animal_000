import {
  FEATURED_ANIMALS_LIMIT,
  type AdoptionPlanDto,
  type AnimalCardDto,
  type AnimalUpdateDto,
  type CatalogQuery,
  type HomeDto,
  type Paginated,
  type PaginationQuery,
  type PublicAnimalDto,
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

// Casos de uso de la web pública: CU-01, CU-02, CU-03 y CU-04.
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

    /** CU-03: ficha pública con galería y adoptantes que aceptan aparecer. */
    async getAnimal(id: number): Promise<PublicAnimalDto> {
      const animal = await animalPublico(id);
      const [photos, publicAdopterNames] = await Promise.all([
        photoModel.listPublicGallery(db, id),
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
      };
    },

    /** CU-03: últimas actualizaciones públicas del animal. */
    async listUpdates(animalId: number, query: PaginationQuery): Promise<Paginated<AnimalUpdateDto>> {
      await animalPublico(animalId);
      const pagina = paginar(query, await updateModel.countPublicByAnimal(db, animalId));
      const actualizaciones =
        pagina.total === 0
          ? []
          : await updateModel.listPublicByAnimal(db, animalId, { limit: pagina.pageSize, offset: pagina.offset });
      const fotos = await photoModel.listPublicByUpdates(
        db,
        actualizaciones.map((u) => u.id),
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
