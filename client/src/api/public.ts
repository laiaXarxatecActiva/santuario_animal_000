import type {
  AdoptionPlanDto,
  AnimalCardDto,
  AnimalUpdateDto,
  HomeDto,
  Paginated,
  PublicAnimalDto,
  SpeciesSummary,
} from '@sanctuary/shared';
import type { ApiQuery } from '../utils/catalogParams';
import { apiGet } from './client';

// Web pública (TECH_SPEC §10.3).
export const publicApi = {
  home: () => apiGet<HomeDto>('/api/home'),
  animals: (query: ApiQuery) => apiGet<Paginated<AnimalCardDto>>('/api/animals', query),
  animal: (id: number) => apiGet<PublicAnimalDto>(`/api/animals/${id}`),
  animalUpdates: (id: number, pageSize: number) =>
    apiGet<Paginated<AnimalUpdateDto>>(`/api/animals/${id}/updates`, { pageSize }),
  species: () => apiGet<{ data: SpeciesSummary[] }>('/api/species').then((r) => r.data),
  plans: () => apiGet<{ data: AdoptionPlanDto[] }>('/api/plans').then((r) => r.data),
};
