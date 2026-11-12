import type { FeedItemDto, FeedQuery, FeedResponse } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { paginar } from '../dominio/paginacion.js';
import { NotFoundError } from '../errors/app-error.js';
import * as photoModel from '../models/photo.model.js';
import * as updateModel from '../models/animal-update.model.js';
import * as updateReadModel from '../models/update-read.model.js';

export interface FeedServiceDeps {
  db: Queryable;
}

// CU-17: muro de actualizaciones del adoptante y marcas de leído (también CU-16 paso 3).
export function createFeedService({ db }: FeedServiceDeps) {
  /** Una actualización que el adoptante no puede ver no existe para él (404). */
  async function comprobarVisible(userId: number, updateId: number): Promise<void> {
    if (!(await updateModel.isVisibleToAdopter(db, userId, updateId))) throw new NotFoundError();
  }

  return {
    async list(userId: number, query: FeedQuery): Promise<FeedResponse> {
      const filtros = { unread: query.unread, animalId: query.animalId };
      const [total, unreadCount] = await Promise.all([
        updateModel.countFeed(db, userId, filtros),
        updateModel.countFeed(db, userId, { unread: true }),
      ]);
      const pagina = paginar(query, total);
      const actualizaciones =
        total === 0
          ? []
          : await updateModel.listFeed(db, userId, filtros, { limit: pagina.pageSize, offset: pagina.offset });
      // El muro solo tiene animales con adopción activa: se ven todas sus fotos (RN-15).
      const fotos = await photoModel.listByUpdates(
        db,
        actualizaciones.map((u) => u.id),
        { includeAdopters: true },
      );
      const data: FeedItemDto[] = actualizaciones.map((u) => ({ ...u, photos: fotos.get(u.id) ?? [] }));
      return {
        data,
        meta: { page: pagina.page, pageSize: pagina.pageSize, total, totalPages: pagina.totalPages, unreadCount },
      };
    },

    async markRead(userId: number, updateId: number): Promise<void> {
      await comprobarVisible(userId, updateId);
      await updateReadModel.markRead(db, userId, updateId);
    },

    async markUnread(userId: number, updateId: number): Promise<void> {
      await comprobarVisible(userId, updateId);
      await updateReadModel.markUnread(db, userId, updateId);
    },
  };
}

export type FeedService = ReturnType<typeof createFeedService>;
