import { describe, expect, it } from 'vitest';
import { notificationPatchSchema, notificationsQuerySchema } from '../src/schemas/notification.schema.js';

describe('CU-18 notificationsQuerySchema', () => {
  it('por defecto: primera página de 20, todas', () => {
    expect(notificationsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20, unread: false });
  });

  it('?unread=true filtra las no leídas', () => {
    expect(notificationsQuerySchema.parse({ unread: 'true', page: '2', pageSize: '10' })).toEqual({
      page: 2,
      pageSize: 10,
      unread: true,
    });
    expect(notificationsQuerySchema.safeParse({ unread: 'si' }).success).toBe(false);
  });
});

describe('CU-18 notificationPatchSchema', () => {
  it('solo admite isRead booleano', () => {
    expect(notificationPatchSchema.parse({ isRead: true })).toEqual({ isRead: true });
    expect(notificationPatchSchema.safeParse({ isRead: 'true' }).success).toBe(false);
    expect(notificationPatchSchema.safeParse({}).success).toBe(false);
  });
});
