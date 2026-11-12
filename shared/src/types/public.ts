import type { AnimalSex } from '../constants/animals.js';
import type { AnimalStatus } from '../constants/status.js';

// Respuestas de la web pública (TECH_SPEC §10.3). Fechas `DATE` como
// `YYYY-MM-DD`, instantes como ISO 8601 e importes como string.

export interface SpeciesSummary {
  id: number;
  name: string;
  scientificName: string | null;
}

export interface PhotoDto {
  id: number;
  mediaType: 'image' | 'video';
  url: string;
  thumbnailUrl: string | null;
  altText: string;
}

/** Tarjeta del catálogo y de los destacados (CU-01, CU-02). */
export interface AnimalCardDto {
  id: number;
  name: string;
  species: SpeciesSummary;
  sex: AnimalSex;
  status: AnimalStatus;
  approxAgeYears: number | null;
  isAdoptable: boolean;
  adopterCount: number;
  coverPhoto: PhotoDto | null;
}

/** Ficha pública de un animal (CU-03). */
export interface PublicAnimalDto extends AnimalCardDto {
  breed: string | null;
  approxBirthDate: string | null;
  arrivalDate: string;
  rescueStory: string | null;
  temperament: string | null;
  specialNeeds: string | null;
  /** Nombres de los adoptantes activos que han aceptado aparecer (RN-16). */
  publicAdopterNames: string[];
  photos: PhotoDto[];
}

export interface AnimalUpdateDto {
  id: number;
  title: string;
  body: string;
  visibility: 'public' | 'adopters';
  publishedAt: string;
  photos: PhotoDto[];
}

export interface HomeDto {
  shelteredCount: number;
  featured: AnimalCardDto[];
}

export interface AdoptionPlanDto {
  id: number;
  name: string;
  monthlyAmount: string;
  description: string | null;
  isDefault: boolean;
}
