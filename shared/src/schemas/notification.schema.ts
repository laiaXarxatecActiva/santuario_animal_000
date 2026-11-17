import { z } from 'zod';
import { paginationQuerySchema } from './pagination.schema.js';

// GET /api/me/notifications?unread=true&page&pageSize (CU-18).
export const notificationsQuerySchema = paginationQuerySchema.extend({
  unread: z
    .enum(['true', 'false'])
    .transform((valor) => valor === 'true')
    .default(false),
});
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;

// PATCH /api/me/notifications/:id
export const notificationPatchSchema = z.object({ isRead: z.boolean() });
export type NotificationPatch = z.infer<typeof notificationPatchSchema>;
