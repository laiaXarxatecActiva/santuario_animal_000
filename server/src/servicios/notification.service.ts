import type { NotificationDto, NotificationsQuery, NotificationsResponse } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { paginar } from '../dominio/paginacion.js';
import { NotFoundError } from '../errors/app-error.js';
import * as notificationModel from '../models/notification.model.js';

export interface NotificationServiceDeps {
  db: Queryable;
}

// CU-18: la campana de cualquier usuario autenticado.
export function createNotificationService({ db }: NotificationServiceDeps) {
  return {
    async list(userId: number, query: NotificationsQuery): Promise<NotificationsResponse> {
      const [total, unreadCount] = await Promise.all([
        notificationModel.count(db, userId, { unread: query.unread }),
        notificationModel.count(db, userId, { unread: true }),
      ]);
      const pagina = paginar(query, total);
      const data =
        total === 0
          ? []
          : await notificationModel.list(
              db,
              userId,
              { unread: query.unread },
              {
                limit: pagina.pageSize,
                offset: pagina.offset,
              },
            );
      return {
        data,
        meta: { page: pagina.page, pageSize: pagina.pageSize, total, totalPages: pagina.totalPages, unreadCount },
      };
    },

    async setRead(userId: number, id: number, isRead: boolean): Promise<NotificationDto> {
      const notificacion = await notificationModel.setRead(db, userId, id, isRead);
      if (!notificacion) throw new NotFoundError();
      return notificacion;
    },

    async markAllRead(userId: number): Promise<void> {
      await notificationModel.markAllRead(db, userId);
    },

    async remove(userId: number, id: number): Promise<void> {
      if (!(await notificationModel.remove(db, userId, id))) throw new NotFoundError();
    },
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
