import type { FeedResponse } from '@sanctuary/shared';
import { apiDelete, apiGet, apiPut } from './client';

export interface FeedParams {
  page?: number;
  pageSize: number;
  unread?: boolean;
  animalId?: number;
}

// Muro del adoptante (CU-17, TECH_SPEC §10.4).
export const feedApi = {
  list: ({ page, pageSize, unread, animalId }: FeedParams) =>
    apiGet<FeedResponse>('/api/me/feed', { page, pageSize, unread: unread ? true : undefined, animalId }),
  markRead: (updateId: number) => apiPut(`/api/me/feed/${updateId}/read`),
  markUnread: (updateId: number) => apiDelete(`/api/me/feed/${updateId}/read`),
};
