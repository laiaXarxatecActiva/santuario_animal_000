import { describe, expect, it } from 'vitest';
import { create } from '../../src/models/notification.model.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

const db = usarBaseDeDatos();

describe('notification.model', () => {
  it('crea una notificación sin leer', async () => {
    await create(db.pool, {
      userId: 10,
      type: 'adoption_welcome',
      message: '¡Ya adoptas a Brisa!',
      link: '/my-animals/5',
    });
    const { rows } = await db.pool.query(
      "SELECT type, message, link, is_read FROM notifications WHERE user_id = 10 AND type = 'adoption_welcome'",
    );
    expect(rows).toEqual([
      { type: 'adoption_welcome', message: '¡Ya adoptas a Brisa!', link: '/my-animals/5', is_read: false },
    ]);
  });
});
