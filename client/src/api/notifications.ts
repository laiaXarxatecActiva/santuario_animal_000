import type { NotificationDto, NotificationsResponse } from '@sanctuary/shared';
import { apiDelete, apiGet, apiPatch, apiPost } from './client';

// Campana (CU-18, TECH_SPEC §10.5).
export const notificationsApi = {
  list: ({ page, pageSize, unread }: { page?: number; pageSize: number; unread?: boolean }) =>
    apiGet<NotificationsResponse>('/api/me/notifications', { page, pageSize, unread: unread ? true : undefined }),
  setRead: ({ id, isRead }: { id: number; isRead: boolean }) =>
    apiPatch<NotificationDto>(`/api/me/notifications/${id}`, { isRead }),
  readAll: () => apiPost('/api/me/notifications/read-all'),
  remove: (id: number) => apiDelete(`/api/me/notifications/${id}`),
};
