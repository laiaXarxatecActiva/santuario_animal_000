import type { IncidentDto, Paginated, TaskDto } from '@sanctuary/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sumarDias } from '../src/dominio/adopcion.js';
import { runTaskAlerts } from '../src/jobs/task-alerts.job.js';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { jpeg, prepararAppConSubidas, type TestAppConSubidas } from './helpers/test-uploads.js';
import { depsDePrueba } from './jobs/helpers.js';

// En TEST_DATA.sql hay tres incidencias: 1 abierta (media, voladero de buitres
// negros, de Andrés), 2 en curso (alta, Pipa en la clínica, de Nuria) y 3
// resuelta (baja, cocina). La 2 tiene su tarea pendiente para mañana («Revisar la
// pata de Pipa»). Hoy tienen turno en la clínica Nuria (mañana) y
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
      tasks: [],
      photos: [],
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

  const conFotos = async (cantidad: number) => {
    let peticion = nuria
      .post('/api/admin/incidents')
      .set('X-Requested-With', 'XMLHttpRequest')
      .field('category', 'health')
      .field('severity', 'low')
      .field('title', 'Pluma rota')
      .field('description', 'Carbón tiene una pluma rota.')
      .field('animalId', '10');
    for (let i = 1; i <= cantidad; i += 1) peticion = peticion.attach('files', await jpeg(), `pluma-${i}.jpg`);
    return peticion;
  };

  it('con varias fotos (hasta 5), en multipart y en el orden en que se enviaron', async () => {
    const res = await conFotos(3);
    expect(res.status).toBe(201);
    const fotos = (res.body as IncidentDto).photos;
    expect(fotos).toHaveLength(3);
    expect(fotos.every((f) => f.includes('/uploads/incidents/'))).toBe(true);
    expect(new Set(fotos).size).toBe(3);
    const ficha = (await nuria.get(`/api/admin/incidents/${(res.body as IncidentDto).id}`)).body as IncidentDto;
    expect(ficha.photos).toEqual(fotos);
  });

  it('más de 5 fotos no se admiten', async () => {
    const res = await conFotos(6);
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'files', message: 'Adjunta como mucho 5 fotos.' }]);
  });

  it('la zona y el animal son opcionales: puede no tener ninguno', async () => {
    const res = await andres
      .post('/api/admin/incidents')
      .send({ category: 'other', severity: 'low', title: 'La furgoneta no arranca', description: 'No arranca.' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ zone: null, animal: null, status: 'open' });
  });

  it('una grave sin zona ni animal avisa solo a los administradores', async () => {
    const res = await nuria.post('/api/admin/incidents').send({
      category: 'facilities',
      severity: 'high',
      title: 'Se ha ido la luz',
      description: 'No hay luz en todo el santuario.',
      zoneId: null,
    });
    expect(res.status).toBe(201);
    const id = (res.body as IncidentDto).id;
    const delAviso = (await avisos()).filter((a) => a.link === `/admin/incidents/${id}`);
    expect(delAviso).toEqual(
      [1, 2].map((userId) => ({
        user_id: userId,
        message: 'Incidencia grave: Se ha ido la luz',
        link: `/admin/incidents/${id}`,
      })),
    );
  });

  it('valida los campos', async () => {
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

  it('«en curso» no se pone a mano (lo pone su tarea), y una en curso no se «reabre»', async () => {
    const enCurso = await marta.patch('/api/admin/incidents/1/status').send({ status: 'in_progress' });
    expect(enCurso.status).toBe(400);
    expect(enCurso.body.error.details).toEqual([{ field: 'status', message: 'Elige el estado.' }]);

    const abrir = await marta.patch('/api/admin/incidents/2/status').send({ status: 'open' });
    expect(abrir.status).toBe(409);
    expect(abrir.body.error.code).toBe('INCIDENT_NOT_RESOLVED');
  });

  it('resolverla (con explicación) y reabrirla', async () => {
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
      { status: ['open', 'resolved'], note: 'Malla cosida con alambre.' },
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
    expect(incident).toMatchObject({
      id: 1,
      status: 'in_progress',
      tasks: [{ id: task.id, title: 'Coser la malla del techo', dueDate: t.hoy, status: 'pending' }],
    });
    expect(task.incidentId).toBe(1);

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

describe('CU-70 La incidencia sigue a su tarea', () => {
  const tarea = (titulo: string, extra: Record<string, unknown> = {}) => ({
    type: 'maintenance',
    title: titulo,
    zoneId: 5,
    dueDate: t.hoy,
    dueTime: '18:00',
    assignedTo: 4,
    ...extra,
  });
  const nuevaIncidencia = async (titulo: string) =>
    (
      (
        await nuria
          .post('/api/admin/incidents')
          .send({ category: 'facilities', severity: 'low', title: titulo, description: `${titulo}.`, zoneId: 5 })
      ).body as IncidentDto
    ).id;
  const crearTarea = async (incidenciaId: number, titulo: string) => {
    const res = await marta.post(`/api/admin/incidents/${incidenciaId}/task`).send(tarea(titulo));
    expect(res.status).toBe(201);
    return (res.body as { task: TaskDto }).task.id;
  };
  const ficha = async (id: number) => (await nuria.get(`/api/admin/incidents/${id}`)).body as IncidentDto;
  const estadoDeLaTarea = async (id: number) =>
    (
      await t.pool.query<{ status: string; observations: string | null }>(
        'SELECT status, observations FROM task_instances WHERE id = $1',
        [id],
      )
    ).rows[0];

  it('al hacer la tarea, la incidencia se resuelve sola con la nota de la tarea y quién la hizo', async () => {
    const id = await nuevaIncidencia('Bombilla fundida');
    const tareaId = await crearTarea(id, 'Cambiar la bombilla');
    const hecha = await andres.post(`/api/admin/tasks/${tareaId}/complete`).send({ observations: 'Bombilla nueva.' });
    expect(hecha.status).toBe(200);
    expect(await ficha(id)).toMatchObject({
      status: 'resolved',
      resolution: 'Bombilla nueva.',
      resolvedBy: { id: 4, name: 'Andrés Climent Mas' },
      tasks: [{ id: tareaId, status: 'completed' }],
    });
    expect((await acciones(id)).at(-1)?.details).toEqual({
      status: ['in_progress', 'resolved'],
      task: 'Cambiar la bombilla',
    });
  });

  it('sin nota, la resolución dice con qué tarea se resolvió; al reabrir la tarea, vuelve a «en curso»', async () => {
    const id = await nuevaIncidencia('Cerrojo duro');
    const tareaId = await crearTarea(id, 'Engrasar el cerrojo');
    await andres.post(`/api/admin/tasks/${tareaId}/complete`).send({});
    expect(await ficha(id)).toMatchObject({
      status: 'resolved',
      resolution: 'Resuelta con la tarea «Engrasar el cerrojo».',
    });
    expect((await marta.post(`/api/admin/tasks/${tareaId}/reopen`).send({})).status).toBe(200);
    expect(await ficha(id)).toMatchObject({ status: 'in_progress', resolution: null, resolvedBy: null });
  });

  it('si la tarea no se pudo hacer, vuelve a «abierta» y se puede crear otra; la ficha guarda las dos', async () => {
    const id = await nuevaIncidencia('Valla caída');
    const primera = await crearTarea(id, 'Levantar la valla');
    await andres.post(`/api/admin/tasks/${primera}/not-done`).send({ reason: 'Falta material.' });
    expect(await ficha(id)).toMatchObject({ status: 'open' });
    const segunda = await crearTarea(id, 'Levantar la valla con el material nuevo');
    expect((await ficha(id)).tasks.map((x) => [x.id, x.status])).toEqual([
      [segunda, 'pending'],
      [primera, 'not_done'],
    ]);
    expect((await ficha(id)).status).toBe('in_progress');
  });

  it('al borrar su tarea pendiente, vuelve a «abierta»', async () => {
    const id = await nuevaIncidencia('Manguera rota');
    const tareaId = await crearTarea(id, 'Cambiar la manguera');
    expect((await marta.delete(`/api/admin/tasks/${tareaId}`).send({})).status).toBe(204);
    expect(await ficha(id)).toMatchObject({ status: 'open', tasks: [] });
  });

  it('si el sistema cierra la tarea al acabar el día, vuelve a «abierta»', async () => {
    const id = await nuevaIncidencia('Comedero roto');
    const tareaId = await crearTarea(id, 'Cambiar el comedero');
    await runTaskAlerts(depsDePrueba(t, { hoy: sumarDias(t.hoy, 1) }));
    expect((await estadoDeLaTarea(tareaId))?.status).toBe('not_done');
    expect(await ficha(id)).toMatchObject({ status: 'open' });
    expect((await acciones(id)).at(-1)?.details).toEqual({
      status: ['in_progress', 'open'],
      task: 'Cambiar el comedero',
    });
  });

  it('al resolverla a mano, su tarea pendiente se cierra sola como hecha (se ve «Resuelta»)', async () => {
    const id = await nuevaIncidencia('Gotera en el almacén');
    const tareaId = await crearTarea(id, 'Tapar la gotera');
    const res = await nuria
      .patch(`/api/admin/incidents/${id}/status`)
      .send({ status: 'resolved', note: 'Ya no gotea.' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'resolved', resolution: 'Ya no gotea.' });
    expect(await estadoDeLaTarea(tareaId)).toEqual({
      status: 'completed',
      observations: 'Ya no hace falta: la incidencia se ha resuelto.',
    });
  });

  it('al reabrir una resuelta se puede crear otra tarea', async () => {
    const id = await nuevaIncidencia('Puerta que chirría');
    const primera = await crearTarea(id, 'Engrasar la puerta');
    await andres.post(`/api/admin/tasks/${primera}/complete`).send({});
    await marta.patch(`/api/admin/incidents/${id}/status`).send({ status: 'open', note: 'Vuelve a chirriar.' });
    const segunda = await crearTarea(id, 'Cambiar las bisagras');
    expect((await ficha(id)).tasks.map((x) => x.id)).toEqual([segunda, primera]);
  });

  it('la base de datos no admite dos tareas pendientes de la misma incidencia', async () => {
    await expect(
      t.pool.query(
        `INSERT INTO task_instances (type, title, zone_id, due_date, due_time, due_at, incident_id)
         VALUES ('maintenance', 'Otra', 4, CURRENT_DATE, '10:00', NOW(), 2)`,
      ),
    ).rejects.toMatchObject({ code: '23505' });
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
