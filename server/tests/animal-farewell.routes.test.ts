import { sumarDias } from '../src/dominio/adopcion.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
let nuria: Agente;
beforeAll(async () => {
  t = await prepararApp();
  nuria = await entrarComo(t.app, 'nuria');
});
afterAll(() => t.pool.end());
beforeEach(() => {
  t.mailer.outbox.length = 0;
});

const cerradas = async (animalId: number) =>
  (
    await t.pool.query(
      `SELECT user_id, type, message, link FROM notifications
        WHERE type = 'adoption_closed' AND message LIKE $1 ORDER BY user_id`,
      [`%${animalId === 11 ? 'Lupe' : animalId === 7 ? 'Nieve' : 'Roca'}%`],
    )
  ).rows;

describe('CU-33 Registrar el fallecimiento o traslado de un animal: mensajes y avisos', () => {
  it('3a: un fallecimiento con adoptantes afectados necesita el mensaje; no cambia nada', async () => {
    const res = await nuria.patch('/api/admin/animals/11/status').send({ status: 'deceased', message: '   ' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: 'FAREWELL_MESSAGE_REQUIRED',
      details: [{ field: 'message', message: 'Escribe el mensaje para los adoptantes.' }],
    });
    const { rows } = await t.pool.query('SELECT status FROM animals WHERE id = 11');
    expect(rows[0].status).toBe('in_sanctuary');
    expect(t.mailer.outbox).toEqual([]);
  });

  it('5-6: fallecimiento: publica el mensaje para adoptantes, cierra las adopciones y avisa a cada afectado', async () => {
    const fecha = sumarDias(t.hoy, -1);
    // Lupe (11): la adopción pausada de Elena y una pendiente de Adrián (13).
    await t.pool.query('INSERT INTO adoptions (user_id, animal_id, plan_id) VALUES (13, 11, 1)');
    const mensaje = 'Lupe se fue ayer, tranquila y al sol.\nGracias por acompañarla.';
    const res = await nuria
      .patch('/api/admin/animals/11/status')
      .send({ status: 'deceased', date: fecha, message: mensaje });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'deceased', statusChangedAt: fecha, openAdoptions: 0 });

    const { rows: actualizaciones } = await t.pool.query(
      'SELECT author_id, title, body, visibility FROM animal_updates WHERE animal_id = 11 ORDER BY id DESC LIMIT 1',
    );
    expect(actualizaciones).toEqual([
      { author_id: 3, title: 'Despedimos a Lupe', body: mensaje, visibility: 'adopters' },
    ]);

    expect(await cerradas(11)).toEqual([
      {
        user_id: 8,
        type: 'adoption_closed',
        message: 'Lamentamos comunicarte que Lupe ha fallecido. Tu adopción se ha cerrado.',
        link: '/animals',
      },
      {
        user_id: 13,
        type: 'adoption_closed',
        message: 'Lamentamos comunicarte que Lupe ha fallecido. Tu adopción se ha cerrado.',
        link: '/animals',
      },
    ]);
    expect(t.mailer.outbox.map((m) => m.to).sort()).toEqual(['adrian.moreno@correo.test', 'elena.rubio@correo.test']);
    expect(t.mailer.outbox[0]).toMatchObject({ subject: 'Despedimos a Lupe' });
    expect(t.mailer.outbox[0]!.text).toContain(mensaje);
  });

  it('5-6: traslado: cierra las adopciones y avisa sin publicar actualización', async () => {
    const antes = (await t.pool.query('SELECT count(*)::int AS n FROM animal_updates WHERE animal_id = 7')).rows[0].n;
    const res = await nuria.patch('/api/admin/animals/7/status').send({ status: 'transferred' });
    expect(res.status).toBe(200);
    expect((await t.pool.query('SELECT count(*)::int AS n FROM animal_updates WHERE animal_id = 7')).rows[0].n).toBe(
      antes,
    );
    expect(await cerradas(7)).toEqual([
      {
        user_id: 9,
        type: 'adoption_closed',
        message: 'Nieve se ha trasladado a otro centro. Tu adopción se ha cerrado.',
        link: '/animals',
      },
    ]);
    expect(t.mailer.outbox.map((m) => m.to)).toEqual(['sergio.llorens@correo.test']);
    expect(t.mailer.outbox[0]).toMatchObject({ subject: 'Nieve se traslada a otro centro' });
  });

  it('2a: sin adopciones abiertas se cambia el estado sin mensaje, sin actualización y sin avisos', async () => {
    const res = await nuria.patch('/api/admin/animals/15/status').send({ status: 'deceased', message: 'Adiós, Roca.' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('deceased');
    const { rows } = await t.pool.query(
      "SELECT count(*)::int AS n FROM animal_updates WHERE title = 'Despedimos a Roca'",
    );
    expect(rows[0].n).toBe(0);
    expect(await cerradas(15)).toEqual([]);
    expect(t.mailer.outbox).toEqual([]);
  });

  it('si falla un email, el cambio de estado y las notificaciones se mantienen', async () => {
    t.mailer.failNext = true;
    const res = await nuria
      .patch('/api/admin/animals/8/status')
      .send({ status: 'deceased', message: 'Sombra nos ha dejado.' });
    expect(res.status).toBe(200);
    const { rows } = await t.pool.query(
      "SELECT count(*)::int AS n FROM notifications WHERE type = 'adoption_closed' AND message LIKE '%Sombra%'",
    );
    expect(rows[0].n).toBe(2);
  });
});
