import type { NotificationDto, NotificationsResponse } from '@sanctuary/shared';

export function notification(overrides: Partial<NotificationDto> = {}): NotificationDto {
  return {
    id: 2,
    type: 'new_update',
    message: 'Nueva actualización de Carbón: «Carbón respira mejor».',
    link: '/my-animals/10',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
    ...overrides,
  };
}

export const notificationsPage = (
  data: NotificationDto[],
  meta: Partial<NotificationsResponse['meta']> = {},
): NotificationsResponse => ({
  data,
  meta: {
    page: 1,
    pageSize: 20,
    total: data.length,
    totalPages: data.length === 0 ? 0 : 1,
    unreadCount: data.filter((n) => !n.isRead).length,
    ...meta,
  },
});
