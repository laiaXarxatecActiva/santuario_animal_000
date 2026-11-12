import type { AdoptionDto, CreateAdoptionInput, PayAdoptionResponse, SimulatedOutcome } from '@sanctuary/shared';
import { apiGet, apiPost } from './client';

// Área del adoptante: adopciones y pagos (TECH_SPEC §10.4).
export const adoptionsApi = {
  create: (datos: CreateAdoptionInput) => apiPost<AdoptionDto>('/api/adoptions', datos),
  mine: (animalId?: number) => apiGet<{ data: AdoptionDto[] }>('/api/me/adoptions', { animalId }).then((r) => r.data),
  pay: (id: number, simulatedOutcome: SimulatedOutcome) =>
    apiPost<PayAdoptionResponse>(`/api/me/adoptions/${id}/pay`, { simulatedOutcome }),
};
