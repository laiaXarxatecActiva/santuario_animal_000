import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../src/errors/app-error.js';
import { createFeedService } from '../src/servicios/feed.service.js';
import { usarBaseDeDatos } from './helpers/db-fixture.js';

const db = usarBaseDeDatos();

describe('CU-17 createFeedService', () => {
  it('el contador de no leídas ignora los filtros de la lista', async () => {
    const service = createFeedService({ db: db.pool });
    const res = await service.list(6, { page: 1, pageSize: 20, unread: false, animalId: 8 });
    expect(res.data.map((u) => u.id)).toEqual([4, 3]);
    expect(res.meta.unreadCount).toBe(1);
  });

  it('marcar una actualización que no puede ver lanza NotFoundError', async () => {
    const service = createFeedService({ db: db.pool });
    await expect(service.markRead(8, 7)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.markUnread(8, 7)).rejects.toBeInstanceOf(NotFoundError);
  });
});
