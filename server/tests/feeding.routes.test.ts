import type { MyDayDto, MyDayTaskDto, TaskDto } from '@sanctuary/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { jpeg, prepararAppConSubidas, type TestAppConSubidas } from './helpers/test-uploads.js';

// En TEST_DATA.sql, la «Comida de la clínica» (plantilla 4) es a las 09:00 y a
// las 17:00, sin animales: es de los que viven en la clínica (Carbón, Olmo y
// Pipa). Esta mañana Carbón comió menos de la mitad. Hoy tienen turno en la
// clínica Nuria (mañana) y Carmen (tarde); Andrés no.

let t: TestAppConSubidas;
let marta: Agente;
let nuria: Agente;
beforeAll(async () => {
  t = await prepararAppConSubidas();
  marta = await entrarComo(t.app, 'marta');
  nuria = await entrarComo(t.app, 'nuria');
});
afterAll(() => t.cerrar());

const tareaDe = async (plantillaId: number, hora: string): Promise<number> => {
  const { rows } = await t.pool.query<{ id: number }>(
    "SELECT id FROM task_instances WHERE template_id = $1 AND due_date = $2 AND to_char(due_time, 'HH24:MI') = $3",
    [plantillaId, t.hoy, hora],
  );
  return rows[0]!.id;
};

const miDia = async (): Promise<MyDayDto> => (await nuria.get('/api/admin/my-day')).body;

const avisosComePoco = async (): Promise<{ user_id: number; message: string; link: string }[]> =>
  (
    await t.pool.query<{ user_id: number; message: string; link: string }>(
      "SELECT user_id, message, link FROM notifications WHERE type = 'low_intake' ORDER BY user_id, id",
    )
  ).rows;

describe('CU-66 Anotar lo que ha comido cada animal', () => {
  it('en «Mi día», una comida sin animales ofrece los que viven en su zona', async () => {
    const id = await tareaDe(4, '17:00');
    const comida = (await miDia()).tasks.find((x) => x.id === id) as MyDayTaskDto;
    expect(comida.feedingAnimals).toEqual([
      { id: 10, name: 'Carbón' },
      { id: 4, name: 'Olmo' },
      { id: 14, name: 'Pipa' },
    ]);
    // Las que no son de alimentación no tienen comida que anotar.
    const limpieza = (await miDia()).tasks.find((x) => x.title === 'Limpieza de la clínica');
    expect(limpieza?.feedingAnimals).toEqual([]);
  });

  it('un animal que no es de esa comida es un error en el campo', async () => {
    const id = await tareaDe(4, '17:00');
    const res = await nuria
      .post(`/api/admin/tasks/${id}/complete`)
      .send({ intakes: [{ animalId: 1, intake: 'none' }] });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('intakes');
  });

  it('al completarla se anota cada animal («todo» si no se dice otra cosa)', async () => {
    const id = await tareaDe(4, '17:00');
    const res = await nuria
      .post(`/api/admin/tasks/${id}/complete`)
      .send({ intakes: [{ animalId: 14, intake: 'most' }] });
    expect(res.status).toBe(200);
    const tarea: TaskDto = res.body;
    expect(tarea.intakes).toEqual([
      { animal: { id: 10, name: 'Carbón' }, intake: 'all' },
      { animal: { id: 4, name: 'Olmo' }, intake: 'all' },
      { animal: { id: 14, name: 'Pipa' }, intake: 'most' },
    ]);
    // Carbón ha comido todo: se corta su racha y no hay aviso.
    expect(await avisosComePoco()).toEqual([]);

    // Deshacer la borra.
    expect((await nuria.post(`/api/admin/tasks/${id}/reopen`).send({})).body.intakes).toEqual([]);
  });

  it('en multipart, con foto, la comida llega como texto JSON', async () => {
    const id = await tareaDe(3, '10:00');
    await t.pool.query(
      "UPDATE task_instances SET status = 'pending', resolved_by = NULL, resolved_at = NULL WHERE id = $1",
      [id],
    );
    await t.pool.query('DELETE FROM feeding_logs WHERE task_id = $1', [id]);
    const res = await nuria
      .post(`/api/admin/tasks/${id}/complete`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .field('intakes', JSON.stringify([{ animalId: 11, intake: 'little' }]))
      .attach('files', await jpeg(), 'comida.jpg');
    expect(res.status).toBe(200);
    // Lupe (11) es el único alimoche que sigue en el santuario.
    expect(res.body.intakes).toEqual([{ animal: { id: 11, name: 'Lupe' }, intake: 'little' }]);
    expect(res.body.photoUrl).toEqual(expect.any(String));
  });
});

describe('CU-67 Aviso si un animal come poco', () => {
  it('a la segunda toma seguida comiendo poco, avisa a los administradores y a quien tiene turno en la zona', async () => {
    const id = await tareaDe(4, '17:00');
    const res = await nuria
      .post(`/api/admin/tasks/${id}/complete`)
      .send({ intakes: [{ animalId: 10, intake: 'none' }] });
    expect(res.status).toBe(200);
    const avisos = await avisosComePoco();
    // Marta (1) y Javier (2), administradores; Nuria (3) y Carmen (5), de turno en la clínica.
    expect(avisos.map((a) => a.user_id)).toEqual([1, 2, 3, 5]);
    expect(avisos[0]).toEqual({
      user_id: 1,
      message: 'Carbón ha comido poco en sus 2 últimas tomas.',
      link: '/admin/animals/10/care',
    });
  });

  it('la misma racha no se vuelve a avisar aunque se deshaga y se complete otra vez', async () => {
    const id = await tareaDe(4, '17:00');
    await nuria.post(`/api/admin/tasks/${id}/reopen`).send({});
    await nuria.post(`/api/admin/tasks/${id}/complete`).send({ intakes: [{ animalId: 10, intake: 'little' }] });
    expect(await avisosComePoco()).toHaveLength(4);
  });

  it('el número de tomas se cambia en los ajustes (solo el administrador) y se conserva si no se envía', async () => {
    const res = await marta.put('/api/admin/work-settings').send({ lateMarginMinutes: 30, lowIntakeMeals: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ lateMarginMinutes: 30, lowIntakeMeals: 3 });
    const sinCambio = await marta.put('/api/admin/work-settings').send({ lateMarginMinutes: 45 });
    expect(sinCambio.body).toEqual({ lateMarginMinutes: 45, lowIntakeMeals: 3 });
    const fuera = await marta.put('/api/admin/work-settings').send({ lateMarginMinutes: 30, lowIntakeMeals: 0 });
    expect(fuera.status).toBe(400);
    expect(fuera.body.error.details[0].field).toBe('lowIntakeMeals');
  });
});
