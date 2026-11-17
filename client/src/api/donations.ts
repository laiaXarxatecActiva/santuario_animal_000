import type { ContactInput, DonationData, DonationResultDto, MessageResponse } from '@sanctuary/shared';
import { apiPost } from './client';

// CU-05 y CU-06 (TECH_SPEC §10.3): públicas, con sesión opcional.
export const donationsApi = {
  donate: (datos: DonationData) => apiPost<DonationResultDto>('/api/donations', datos),
  contact: (datos: ContactInput) => apiPost<MessageResponse>('/api/contact', datos),
};
