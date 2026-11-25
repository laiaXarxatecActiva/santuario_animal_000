import type { IncidentDto, Paginated, TaskDto } from '@sanctuary/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { jpeg, prepararAppConSubidas, type TestAppConSubidas } from './helpers/test-uploads.js';

// En TEST_DATA.sql hay tres incidencias: 1 abierta (media, voladero de buitres
// negros, de Andrés), 2 en curso (alta, Pipa en la clínica, de Nuria) y 3
// resuelta (baja, cocina). Hoy tienen turno en la clínica Nuria (mañana) y
// Carmen (tarde). Pipa (14) vive en la clínica (zona 4).

let t: TestAppConSubidas;
let marta: Agente;
let nuria: Agente;
let andres: Agente;
let lucia: Agente;
beforeAll(async () => {
  t = await prepararAppConSubidas();
  marta = await entrarComo(t.app, 'marta');
  nuria = await entrarComo(t.app, 'nuria');
  andres = await entrarComo(t.app, 'andres');
  lucia = await entrarComo(t.app, 'lucia');
});
afterAll(() => t.cerrar());

const avisos = async () =>
  (
    await t.pool.query<{ user_id: number; message: string; link: string }>(
      "SELECT user_id, message, link FROM notifications WHERE type = 'incident_reported' ORDER BY user_id, id",
    )
  ).rows;

const acciones = async (id: number) =>
  (
    await t.pool.query<{ action: string; details: Record<string, unknown> }>(
      "SELECT action, details FROM activity_logs WHERE table_name = 'incidents' AND record_id = $1 ORDER BY id",
      [id],
    )
  ).rows;

describe('CU-70 Comunicar una incidencia', () => {
  it('cualquier trabajador la comunica; con un animal, la zona es la suya', async () => {
    const res = await andres.post('/api/admin/incidents').send({
      category: 'behavior',
      severity: 'medium',
      title: 'Olmo, nervioso por la obra',
      description: 'Olmo está muy nervioso con la obra de al lado.',
      animalId: 4,
    });
    expect(res.status).toBe(201);
    const incidencia = res.body as IncidentDto;
    expect(incidencia).toMatchObject({
      category: 'behavior',
      severity: 'medium',
      title: 'Olmo, nervioso por la obra',
      description: 'Olmo está muy nervioso con la obra de al lado.',
      animal: { id: 4, name: 'Olmo' },
      zone: { id: 4, name: 'Clínica y recuperación' },
      status: 'open',
      reportedBy: { id: 4, name: 'Andrés Climent Mas' },
      resolution: null,
      taskId: null,
      photoUrl: null,
    });
    // Una de gravedad media no se avisa al momento.
    expect(await avisos()).toEqual([]);
    expect((await acciones(incidencia.id)).map((a) => a.action)).toEqual(['create']);
  });

  it('una de gravedad alta avisa a los administradores y a quien tiene turno en la zona, salvo a quien la comunica', async () => {
    const res = await nuria.post('/api/admin/incidents').send({
      category: 'facilities',
      severity: 'high',
      title: 'Puerta de la cuarentena rota',
      description: 'La puerta de la cuarentena no cierra.',
      zoneId: 4,
    });
    expect(res.status).toBe(201);
    const id = (res.body as IncidentDto).id;
    // Marta (1) y Javier (2) son administradores; Carmen (5) tiene turno de tarde en la clínica.
    expect(await avisos()).toEqual(
      [1, 2, 5].map((userId) => ({
        user_id: userId,
        message: 'Incidencia grave en «Clínica y recuperación»: Puerta de la cuarentena rota',
        link: `/admin/incidents/${id}`,
      })),
    );
  });

  it('con foto, en multipart', async () => {
    const res = await nuria
      .post('/api/admin/incidents')
      .set('X-Requested-With', 'XMLHttpRequest')
      .field('category', 'health')
      .field('severity', 'low')
      .field('title', 'Pluma rota')
      .field('description', 'Carbón tiene una pluma rota.')
      .field('animalId', '10')
      .attach('files', await jpeg(), 'pluma.jpg');
    expect(res.status).toBe(201);
    expect(res.body.photoUrl).toEqual(expect.stringContaining('/uploads/incidents/'));
  });

  it('valida los campos: hace falta una zona o un animal', async () => {
    const sinLugar = await nuria
      .post('/api/admin/incidents')
      .send({ category: 'other', severity: 'low', title: 'Algo raro', description: 'Algo raro.' });
    expect(sinLugar.status).toBe(400);
    expect(sinLugar.body.error.details).toEqual([{ field: 'zoneId', message: 'Elige una zona o un animal.' }]);

    const vacia = await nuria.post('/api/admin/incidents').send({ zoneId: 1 });
    expect(vacia.status).toBe(400);
    expect(vacia.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual([
      'category',
      'description',
      'severity',
      'title',
    ]);

    const animalQueNoEsta = await nuria
      .post('/api/admin/incidents')
      .send({ category: 'health', severity: 'low', title: 'Prueba', description: 'Prueba.', animalId: 13 });
    expect(animalQueNoEsta.status).toBe(422);
    expect(animalQueNoEsta.body.error.code).toBe('CARE_ANIMAL_ARCHIVED');

    const zonaQueNoExiste = await nuria
      .post('/api/admin/incidents')
      .send({ category: 'other', severity: 'low', title: 'Prueba', description: 'Prueba.', zoneId: 999 });
    expect(zonaQueNoExiste.status).toBe(400);
    expect(zonaQueNoExiste.body.error.details).toEqual([
      { field: 'zoneId', message: 'Esta zona no existe o está desactivada.' },
    ]);
  });

  it('el título es obligatorio y corto (de 3 a 80 caracteres)', async () => {
    const base = { category: 'other', severity: 'low', description: 'Prueba.', zoneId: 5 };
    const sinTitulo = await nuria.post('/api/admin/incidents').send({ ...base, title: '  ' });
    expect(sinTitulo.status).toBe(400);
    expect(sinTitulo.body.error.details).toEqual([{ field: 'title', message: 'Escribe un título corto.' }]);
    const largo = await nuria.post('/api/admin/incidents').send({ ...base, title: 'x'.repeat(81) });
    expect(largo.status).toBe(400);
    expect(largo.body.error.details).toEqual([
      { field: 'title', message: 'El título no puede pasar de 80 caracteres.' },
    ]);
  });

  it('solo el personal', async () => {
    expect((await lucia.get('/api/admin/incidents')).status).toBe(403);
  });
});

describe('CU-70 Listado de incidencias', () => {
  it('por defecto, las abiertas y en curso, de la más reciente a la más antigua', async () => {
    const res = await nuria.get('/api/admin/incidents');
    expect(res.status).toBe(200);
    const lista = res.body as Paginated<IncidentDto>;
    expect(lista.data.every((i) => i.status !== 'resolved')).toBe(true);
    expect(lista.data.map((i) => i.id)).toContain(1);
    expect(lista.data.map((i) => i.id)).toContain(2);
    expect(lista.data.map((i) => i.id)).not.toContain(3);
    const fechas = lista.data.map((i) => i.createdAt);
    expect([...fechas].sort().reverse()).toEqual(fechas);
    expect(lista.meta).toMatchObject({ page: 1, total: lista.data.length });
  });

  it('se filtra por estado, gravedad y zona', async () => {
    const resueltas = (await nuria.get('/api/admin/incidents?status=resolved')).body as Paginated<IncidentDto>;
    expect(resueltas.data).toEqual([
      expect.objectContaining({
        id: 3,
        status: 'resolved',
        resolution: 'Termómetro cambiado por uno nuevo.',
        resolvedBy: { id: 1, name: 'Marta Soler Ferrer' },
      }),
    ]);
    const graves = (await nuria.get('/api/admin/incidents?status=all&severity=high&zoneId=4'))
      .body as Paginated<IncidentDto>;
    expect(graves.data.length).toBeGreaterThan(0);
    expect(graves.data.every((i) => i.severity === 'high' && i.zone?.id === 4)).toBe(true);
  });

  it('una incidencia que no existe es 404', async () => {
    expect((await nuria.get('/api/admin/incidents/999')).status).toBe(404);
    expect((await nuria.get('/api/admin/incidents/1')).body).toMatchObject({ id: 1, status: 'open' });
  });

  it('cada incidencia tiene su título y su descripción', async () => {
    expect((await nuria.get('/api/admin/incidents/2')).body).toMatchObject({
      title: 'Pipa cojea',
      description: 'Pipa cojea de la pata derecha desde esta mañana.',
    });
  });
});

describe('CU-70 El personal cambia el estado', () => {
  it('el cuidador también puede resolverla, y queda quién lo hizo', async () => {
    const nueva = await nuria.post('/api/admin/incidents').send({
      category: 'facilities',
      severity: 'low',
      title: 'Grifo que gotea',
      description: 'Grifo que gotea.',
      zoneId: 5,
    });
    const id = (nueva.body as IncidentDto).id;
    const res = await nuria
      .patch(`/api/admin/incidents/${id}/status`)
      .send({ status: 'resolved', note: 'Junta cambiada.' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'resolved', resolvedBy: { id: 3, name: 'Nuria Peris Gil' } });
  });

  it('pasarla a «en curso», resolverla (con explicación) y reabrirla', async () => {
    const enCurso = await marta.patch('/api/admin/incidents/1/status').send({ status: 'in_progress' });
    expect(enCurso.status).toBe(200);
    expect(enCurso.body).toMatchObject({ status: 'in_progress', resolution: null });

    const sinExplicar = await marta.patch('/api/admin/incidents/1/status').send({ status: 'resolved' });
    expect(sinExplicar.status).toBe(400);
    expect(sinExplicar.body.error.details).toEqual([{ field: 'note', message: 'Explica cómo se ha resuelto.' }]);

    const resuelta = await marta
      .patch('/api/admin/incidents/1/status')
      .send({ status: 'resolved', note: 'Malla cosida con alambre.' });
    expect(resuelta.status).toBe(200);
    expect(resuelta.body).toMatchObject({
      status: 'resolved',
      resolution: 'Malla cosida con alambre.',
      resolvedBy: { id: 1, name: 'Marta Soler Ferrer' },
      resolvedAt: expect.any(String),
    });

    const igual = await marta.patch('/api/admin/incidents/1/status').send({ status: 'resolved', note: 'Otra vez.' });
    expect(igual.status).toBe(409);
    expect(igual.body.error.code).toBe('INCIDENT_SAME_STATUS');

    const reabierta = await marta
      .patch('/api/admin/incidents/1/status')
      .send({ status: 'open', note: 'Se ha vuelto a soltar.' });
    expect(reabierta.body).toMatchObject({ status: 'open', resolution: null, resolvedBy: null, resolvedAt: null });

    const registro = await acciones(1);
    expect(registro.map((a) => a.details)).toEqual([
      { status: ['open', 'in_progress'] },
      { status: ['in_progress', 'resolved'], note: 'Malla cosida con alambre.' },
      { status: ['resolved', 'open'], note: 'Se ha vuelto a soltar.' },
    ]);
  });
});

describe('CU-70 Crear una tarea a partir de una incidencia', () => {
  it('el administrador crea una tarea puntual; la incidencia abierta pasa a «en curso»', async () => {
    const res = await marta.post('/api/admin/incidents/1/task').send({
      type: 'maintenance',
      title: 'Coser la malla del techo',
      zoneId: 2,
      dueDate: t.hoy,
      dueTime: '16:00',
      assignedTo: 4,
    });
    expect(res.status).toBe(201);
    const { incident, task } = res.body as { incident: IncidentDto; task: TaskDto };
    expect(task).toMatchObject({ title: 'Coser la malla del techo', isOneOff: true, assignedTo: { id: 4 } });
    expect(incident).toMatchObject({ id: 1, status: 'in_progress', taskId: task.id });

    const otra = await marta.post('/api/admin/incidents/1/task').send({
      type: 'maintenance',
      title: 'Otra',
      zoneId: 2,
      dueDate: t.hoy,
      dueTime: '17:00',
    });
    expect(otra.status).toBe(409);
    expect(otra.body.error.code).toBe('INCIDENT_HAS_TASK');
  });

  it('el cuidador no puede, y una resuelta tampoco admite tarea', async () => {
    const cuerpo = { type: 'maintenance', title: 'Revisar', zoneId: 5, dueDate: t.hoy, dueTime: '18:00' };
    expect((await nuria.post('/api/admin/incidents/3/task').send(cuerpo)).status).toBe(403);
    const resuelta = await marta.post('/api/admin/incidents/3/task').send(cuerpo);
    expect(resuelta.status).toBe(409);
    expect(resuelta.body.error.code).toBe('INCIDENT_RESOLVED');
  });
});

describe('CU-70 Incidencias pendientes', () => {
  it('cuenta las abiertas y las en curso para todo el personal', async () => {
    const res = await nuria.get('/api/admin/incidents/summary');
    expect(res.status).toBe(200);
    const { open, inProgress } = res.body as { open: number; inProgress: number };
    expect(open).toBeGreaterThanOrEqual(0);
    expect(inProgress).toBeGreaterThanOrEqual(0);
    const pendientes = (await nuria.get('/api/admin/incidents?pageSize=100')).body as Paginated<IncidentDto>;
    expect(open + inProgress).toBe(pendientes.meta.total);
    expect((await lucia.get('/api/admin/incidents/summary')).status).toBe(403);
  });
});
