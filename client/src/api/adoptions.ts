import type { AdoptionDto, CreateAdoptionInput, PayAdoptionResponse, SimulatedOutcome } from '@sanctuary/shared';
import { apiGet, apiPatch, apiPost } from './client';

// Área del adoptante: adopciones y pagos (TECH_SPEC §10.4).
export const adoptionsApi = {
  create: (datos: CreateAdoptionInput) => apiPost<AdoptionDto>('/api/adoptions', datos),
  mine: (animalId?: number) => apiGet<{ data: AdoptionDto[] }>('/api/me/adoptions', { animalId }).then((r) => r.data),
  pay: (id: number, simulatedOutcome: SimulatedOutcome) =>
    apiPost<PayAdoptionResponse>(`/api/me/adoptions/${id}/pay`, { simulatedOutcome }),
  /** CU-20: el plan actual anula el cambio programado. */
  changePlan: (id: number, planId: number) => apiPatch<AdoptionDto>(`/api/me/adoptions/${id}/plan`, { planId }),
  /** CU-21. */
  cancel: (id: number) => apiPost<AdoptionDto>(`/api/me/adoptions/${id}/cancel`),
};
