import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararAppConSubidas, type TestAppConSubidas } from './helpers/test-uploads.js';

let t: TestAppConSubidas;
let nuria: Agente;
beforeAll(async () => {
  t = await prepararAppConSubidas();
  nuria = await entrarComo(t.app, 'nuria');
});
afterAll(() => t.cerrar());
beforeEach(() => {
  t.mailer.outbox.length = 0;
});

const publicar = (campos: Record<string, string | number>) => {
  let req = nuria.post('/api/admin/updates').set('X-Requested-With', 'XMLHttpRequest');
  for (const [clave, valor] of Object.entries(campos)) req = req.field(clave, String(valor));
  return req.field('meta', '[]');
};

const notificaciones = async (link: string) =>
  (
    await t.pool.query(
      `SELECT user_id, type, message, is_read FROM notifications
        WHERE link = $1 AND type = 'new_update' AND message LIKE '%Greta bajo la lluvia%' ORDER BY user_id`,
      [link],
    )
  ).rows;

describe('CU-31 Publicar una actualización: avisos a los adoptantes (Fase 2)', () => {
  it('4-5: notifica a cada adoptante activo y envía email solo a quien lo quiere por actualización', async () => {
    // Greta (2): Pablo (per_update) y Elena (monthly_digest), ambos con adopción activa.
    const res = await publicar({ animalId: 2, title: 'Greta bajo la lluvia', body: 'Hoy ha llovido mucho.' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Greta bajo la lluvia', notifiedAdopters: 2 });
    expect(await notificaciones('/my-animals/2')).toEqual([
      {
        user_id: 7,
        type: 'new_update',
        message: 'Nueva actualización de Greta: «Greta bajo la lluvia».',
        is_read: false,
      },
      {
        user_id: 8,
        type: 'new_update',
        message: 'Nueva actualización de Greta: «Greta bajo la lluvia».',
        is_read: false,
      },
    ]);
    expect(t.mailer.outbox.map((m) => m.to)).toEqual(['pablo.garcia@correo.test']);
    expect(t.mailer.outbox[0]).toMatchObject({ subject: 'Nueva actualización de Greta' });
    expect(t.mailer.outbox[0]!.text).toContain('Hoy ha llovido mucho.');
  });

  it('RN-19: quien tiene los emails desactivados recibe la notificación, pero no el email', async () => {
    await t.pool.query('UPDATE users SET email_notifications = FALSE WHERE id = 7');
    const res = await publicar({ animalId: 2, title: 'Greta bajo la lluvia otra vez', body: 'Sigue lloviendo.' });
    expect(res.body.notifiedAdopters).toBe(2);
    expect(t.mailer.outbox).toEqual([]);
    await t.pool.query('UPDATE users SET email_notifications = TRUE WHERE id = 7');
  });

  it('las adopciones pausadas o pendientes no se avisan; 4a: sin adoptantes activos se publica sin avisar', async () => {
    // Lupe (11): solo la adopción pausada de Elena.
    const res = await publicar({ animalId: 11, title: 'Lupe toma el sol', body: 'Hace buen día.' });
    expect(res.status).toBe(201);
    expect(res.body.notifiedAdopters).toBe(0);
    const { rows } = await t.pool.query(
      "SELECT count(*)::int AS n FROM notifications WHERE message LIKE '%Lupe toma el sol%'",
    );
    expect(rows[0].n).toBe(0);
    expect(t.mailer.outbox).toEqual([]);
  });

  it('4b: si falla un email, la actualización y las notificaciones se mantienen', async () => {
    t.mailer.failNext = true;
    const res = await publicar({ animalId: 1, title: 'Rufo y el viento', body: 'Sopla fuerte.' });
    expect(res.status).toBe(201);
    expect(res.body.notifiedAdopters).toBe(2);
    const { rows } = await t.pool.query(
      "SELECT count(*)::int AS n FROM notifications WHERE type = 'new_update' AND message LIKE '%Rufo y el viento%'",
    );
    expect(rows[0].n).toBe(2);
  });

  it('CU-32: editar una actualización no vuelve a notificar', async () => {
    const creada = await publicar({ animalId: 2, title: 'Greta sin cambios', body: 'Texto.' });
    t.mailer.outbox.length = 0;
    const antes = (await t.pool.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n;
    const res = await nuria
      .put(`/api/admin/updates/${creada.body.id}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .field('title', 'Greta con cambios')
      .field('body', 'Texto nuevo.')
      .field('visibility', 'adopters')
      .field('meta', '[]')
      .field('removePhotoIds', '[]');
    expect(res.status).toBe(200);
    expect((await t.pool.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n).toBe(antes);
    expect(t.mailer.outbox).toEqual([]);
  });
});
