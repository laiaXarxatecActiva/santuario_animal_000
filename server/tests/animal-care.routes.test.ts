import type {
  AnimalCareDto,
  DietItemBody,
  DietItemDto,
  MedicationPlanBody,
  MedicationPlanDto,
  VetVisitDto,
} from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sumarDias } from '../src/dominio/tareas.js';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

// En TEST_DATA.sql, Carbón (10) vive en la clínica (zona 4): tiene una dieta
// vigente y otra terminada, una pauta de doxiciclina (2 dosis dadas, 1 no dada
// y la de hoy pendiente) y una visita dentro de 5 días. Pipa (14) tiene una
// visita mañana. Barbas (13) fue trasladado. El reloj marca las 13:00 de Madrid.

let t: TestApp;
let marta: Agente;
let nuria: Agente;
let lucia: Agente;
beforeAll(async () => {
  t = await prepararApp();
  marta = await entrarComo(t.app, 'marta');
  nuria = await entrarComo(t.app, 'nuria');
  lucia = await entrarComo(t.app, 'lucia');
});
afterAll(() => t.pool.end());

const cuidados = async (animalId: number): Promise<AnimalCareDto> => {
  const res = await nuria.get(`/api/admin/animals/${animalId}/care`);
  expect(res.status).toBe(200);
  return res.body;
};

/** Dosis de una pauta: [día, hora, estado], en orden. */
const dosisDe = async (planId: number): Promise<[string, string, string][]> =>
  (
    await t.pool.query<{ d: string; h: string; status: string }>(
      `SELECT due_date::text AS d, to_char(due_time, 'HH24:MI') AS h, status
         FROM task_instances WHERE medication_plan_id = $1 ORDER BY due_at`,
      [planId],
    )
  ).rows.map((r) => [r.d, r.h, r.status]);

const actividad = async (tabla: string, id: number): Promise<string[]> =>
  (
    await t.pool.query<{ action: string }>(
      'SELECT action FROM activity_logs WHERE table_name = $1 AND record_id = $2 ORDER BY id',
      [tabla, id],
    )
  ).rows.map((r) => r.action);

describe('Pestaña «Cuidados» de la ficha del animal (CU-65 a CU-69)', () => {
  it('es del personal: sin sesión 401, un adoptante 403 y un animal que no existe 404', async () => {
    expect((await request(t.app).get('/api/admin/animals/10/care')).status).toBe(401);
    expect((await lucia.get('/api/admin/animals/10/care')).status).toBe(403);
    expect((await nuria.get('/api/admin/animals/9999/care')).status).toBe(404);
  });

  it('junta la dieta, las comidas, la medicación y las visitas', async () => {
    const c = await cuidados(10);
    expect(c.animalId).toBe(10);
    expect(c.diet.map((d) => [d.food, d.isCurrent])).toEqual([
      ['Carne de pollo sin hueso', true],
      ['Papilla de carne picada', false],
    ]);
    expect(c.diet[0]).toMatchObject({ quantity: '400.00', unit: 'g', schedule: 'Mañana y tarde' });
    // La última toma, la de esta mañana, fue «menos de la mitad».
    expect(c.feedings[0]).toMatchObject({ date: t.hoy, time: '09:00', intake: 'little' });
    expect(c.feedings.every((f) => f.date >= sumarDias(t.hoy, -13))).toBe(true);
    expect(c.lowIntakeStreak).toBe(1);
    expect(c.medicationPlans).toEqual([
      expect.objectContaining({
        id: 1,
        medication: 'Doxiciclina',
        dose: '100 mg',
        route: 'oral',
        times: ['10:00'],
        qualification: { id: 1, name: 'Administrar medicación' },
        isActive: true,
        dosesGiven: 2,
        dosesMissed: 1,
        hasHistory: true,
      }),
    ]);
    expect(c.vetVisits).toEqual([
      expect.objectContaining({
        id: 2,
        date: sumarDias(t.hoy, 5),
        time: '10:30',
        status: 'scheduled',
        veterinarian: 'Dra. Paula Sendra',
        vetRecordId: null,
        taskId: expect.any(Number),
      }),
    ]);
  });
});

describe('CU-65 Gestionar la dieta de un animal', () => {
  const alimento = (): DietItemBody => ({
    food: 'Carne de codorniz',
    quantity: '250,5',
    unit: 'g',
    schedule: 'Por la mañana',
    notes: 'Sin plumas.',
    startDate: t.hoy,
  });

  it('el personal añade, edita, termina y borra alimentos, y queda en el registro de actividad', async () => {
    const creado = await nuria.post('/api/admin/animals/14/diet-items').send(alimento());
    expect(creado.status).toBe(201);
    const item: DietItemDto = creado.body;
    expect(item).toMatchObject({ animalId: 14, food: 'Carne de codorniz', quantity: '250.50', isCurrent: true });

    const editado = await nuria.put(`/api/admin/diet-items/${item.id}`).send({ ...alimento(), quantity: 300 });
    expect(editado.status).toBe(200);
    expect(editado.body.quantity).toBe('300.00');

    // Terminarlo es ponerle fecha de fin: deja de estar vigente al día siguiente.
    const ayer = sumarDias(t.hoy, -1);
    const terminado = await nuria
      .put(`/api/admin/diet-items/${item.id}`)
      .send({ ...alimento(), startDate: sumarDias(t.hoy, -10), endDate: ayer });
    expect(terminado.body).toMatchObject({ endDate: ayer, isCurrent: false });

    expect((await nuria.delete(`/api/admin/diet-items/${item.id}`).send({})).status).toBe(204);
    expect((await nuria.delete(`/api/admin/diet-items/${item.id}`).send({})).status).toBe(404);
    expect(await actividad('diet_items', item.id)).toEqual(['create', 'update', 'update', 'delete']);
  });

  it('valida la cantidad, la unidad y las fechas', async () => {
    const res = await nuria
      .post('/api/admin/animals/14/diet-items')
      .send({ ...alimento(), quantity: '0', unit: 'toneladas' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(['quantity', 'unit']);
    const fechas = await nuria
      .post('/api/admin/animals/14/diet-items')
      .send({ ...alimento(), endDate: sumarDias(t.hoy, -1) });
    expect(fechas.status).toBe(400);
    expect(fechas.body.error.details[0].field).toBe('endDate');
  });

  it('un animal trasladado ya no admite cambios en su dieta', async () => {
    const res = await nuria.post('/api/admin/animals/13/diet-items').send(alimento());
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CARE_ANIMAL_ARCHIVED');
  });
});

describe('CU-69 Gestionar las pautas de medicación', () => {
  const pauta = (): MedicationPlanBody => ({
    medication: 'Meloxicam',
    dose: '0,5 ml',
    route: 'oral',
    times: ['20:00', '08:00'],
    startDate: t.hoy,
    endDate: sumarDias(t.hoy, 2),
    qualificationId: 1,
    notes: 'Con la comida.',
  });

  it('al crearla se generan sus dosis de hoy en adelante (solo las que no han pasado)', async () => {
    const res = await nuria.post('/api/admin/animals/14/medication-plans').send(pauta());
    expect(res.status).toBe(201);
    const plan: MedicationPlanDto = res.body;
    expect(plan).toMatchObject({ animalId: 14, times: ['08:00', '20:00'], isActive: true, hasHistory: false });
    const manana = sumarDias(t.hoy, 1);
    const pasado = sumarDias(t.hoy, 2);
    expect(await dosisDe(plan.id)).toEqual([
      [t.hoy, '20:00', 'pending'],
      [manana, '08:00', 'pending'],
      [manana, '20:00', 'pending'],
      [pasado, '08:00', 'pending'],
      [pasado, '20:00', 'pending'],
    ]);
    // Cada dosis sale en «Mi día» como tarea de medicación de la zona del animal.
    const dia = await nuria.get('/api/admin/my-day');
    const dosis = dia.body.tasks.find((x: { medicationPlanId?: number }) => x.medicationPlanId === plan.id);
    expect(dosis).toMatchObject({
      type: 'medication',
      title: 'Meloxicam · 0,5 ml',
      description: 'Con la comida.',
      zone: { id: 4 },
      animals: [{ id: 14, name: 'Pipa' }],
      qualification: { id: 1 },
      isOneOff: false,
    });
    expect(await actividad('medication_plans', plan.id)).toEqual(['create']);
  });

  it('al editarla se rehacen las dosis pendientes de ahora en adelante', async () => {
    const plan: MedicationPlanDto = (await nuria.post('/api/admin/animals/14/medication-plans').send(pauta())).body;
    const res = await nuria
      .put(`/api/admin/medication-plans/${plan.id}`)
      .send({ ...pauta(), times: ['21:00'], endDate: sumarDias(t.hoy, 1) });
    expect(res.status).toBe(200);
    expect(await dosisDe(plan.id)).toEqual([
      [t.hoy, '21:00', 'pending'],
      [sumarDias(t.hoy, 1), '21:00', 'pending'],
    ]);
  });

  it('terminarla la cierra hoy y quita las dosis que faltan; una que no ha empezado no se termina', async () => {
    const plan: MedicationPlanDto = (await nuria.post('/api/admin/animals/14/medication-plans').send(pauta())).body;
    const res = await nuria.post(`/api/admin/medication-plans/${plan.id}/end`).send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ endDate: t.hoy, isActive: true });
    expect(await dosisDe(plan.id)).toEqual([]);

    const futura = await nuria
      .post('/api/admin/animals/14/medication-plans')
      .send({ ...pauta(), startDate: sumarDias(t.hoy, 3), endDate: null });
    const noEmpezada = await nuria.post(`/api/admin/medication-plans/${futura.body.id}/end`).send({});
    expect(noEmpezada.status).toBe(409);
    expect(noEmpezada.body.error.code).toBe('MEDICATION_PLAN_NOT_STARTED');
  });

  it('con dosis resueltas no se borra; sin ellas, sí (y sus dosis también)', async () => {
    const conHistoria = await nuria.delete('/api/admin/medication-plans/1').send({});
    expect(conHistoria.status).toBe(409);
    expect(conHistoria.body.error.code).toBe('MEDICATION_PLAN_HAS_HISTORY');

    const plan: MedicationPlanDto = (await nuria.post('/api/admin/animals/14/medication-plans').send(pauta())).body;
    expect((await nuria.delete(`/api/admin/medication-plans/${plan.id}`).send({})).status).toBe(204);
    expect(await dosisDe(plan.id)).toEqual([]);
    expect(await actividad('medication_plans', plan.id)).toEqual(['create', 'delete']);
  });

  it('valida las horas, la cualificación y el animal', async () => {
    const sinHoras = await nuria.post('/api/admin/animals/14/medication-plans').send({ ...pauta(), times: [] });
    expect(sinHoras.status).toBe(400);
    expect(sinHoras.body.error.details[0].field).toBe('times');

    const cualificacion = await nuria
      .post('/api/admin/animals/14/medication-plans')
      .send({ ...pauta(), qualificationId: 999 });
    expect(cualificacion.status).toBe(400);
    expect(cualificacion.body.error.details[0].field).toBe('qualificationId');

    expect((await nuria.post('/api/admin/animals/13/medication-plans').send(pauta())).status).toBe(422);
  });
});

describe('CU-68 Programar visitas veterinarias', () => {
  const visita = (dia = sumarDias(t.hoy, 1)) => ({
    date: dia,
    time: '12:00',
    reason: 'Revisión del ala',
    veterinarian: 'Dr. Víctor Albiol',
  });

  const tareaDeLaVisita = async (visitaId: number) =>
    (
      await t.pool.query<{ id: number; d: string; h: string; status: string; type: string; title: string }>(
        `SELECT id, due_date::text AS d, to_char(due_time, 'HH24:MI') AS h, status, type, title
           FROM task_instances WHERE vet_visit_id = $1 ORDER BY id`,
        [visitaId],
      )
    ).rows;

  it('programarla crea su tarea en «Mi día»; cambiarla de día la mueve', async () => {
    const res = await nuria.post('/api/admin/animals/4/vet-visits').send(visita());
    expect(res.status).toBe(201);
    const v: VetVisitDto = res.body;
    expect(v).toMatchObject({
      animalId: 4,
      status: 'scheduled',
      reason: 'Revisión del ala',
      taskId: expect.any(Number),
    });
    expect(await tareaDeLaVisita(v.id)).toEqual([
      expect.objectContaining({
        d: sumarDias(t.hoy, 1),
        h: '12:00',
        status: 'pending',
        type: 'health_check',
        title: 'Revisión del ala',
      }),
    ]);

    const movida = await nuria
      .put(`/api/admin/vet-visits/${v.id}`)
      .send({ ...visita(sumarDias(t.hoy, 2)), time: '09:15' });
    expect(movida.status).toBe(200);
    expect(await tareaDeLaVisita(v.id)).toEqual([
      expect.objectContaining({ d: sumarDias(t.hoy, 2), h: '09:15', status: 'pending' }),
    ]);
    expect(await actividad('vet_visits', v.id)).toEqual(['create', 'update']);
  });

  it('no se programa en un día pasado', async () => {
    const res = await nuria.post('/api/admin/animals/4/vet-visits').send(visita(sumarDias(t.hoy, -1)));
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('date');
  });

  it('cancelarla quita su tarea; una visita cancelada ya no se cancela ni se registra', async () => {
    const v: VetVisitDto = (await nuria.post('/api/admin/animals/4/vet-visits').send(visita())).body;
    const res = await nuria.post(`/api/admin/vet-visits/${v.id}/cancel`).send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'cancelled', taskId: null });
    expect(await tareaDeLaVisita(v.id)).toEqual([]);
    const otraVez = await nuria.post(`/api/admin/vet-visits/${v.id}/cancel`).send({});
    expect(otraVez.status).toBe(409);
    expect(otraVez.body.error.code).toBe('VET_VISIT_NOT_SCHEDULED');
  });

  it('registrarla crea el registro del historial y completa su tarea', async () => {
    const v: VetVisitDto = (
      await nuria.post('/api/admin/animals/4/vet-visits').send({ ...visita(t.hoy), time: '08:00' })
    ).body;
    // La tarea de una visita no se completa con «Hecha»: hace falta el registro.
    const directa = await nuria.post(`/api/admin/tasks/${v.taskId}/complete`).send({});
    expect(directa.status).toBe(409);
    expect(directa.body.error.code).toBe('VET_VISIT_NEEDS_RECORD');

    const res = await nuria.post(`/api/admin/vet-visits/${v.id}/complete`).send({
      recordDate: t.hoy,
      type: 'checkup',
      description: 'El ala extiende bien. Alta de la fisioterapia.',
      weightKg: '9,7',
      veterinarian: 'Dr. Víctor Albiol',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'done', vetRecordId: expect.any(Number), taskId: null });
    const registro = await nuria.get(`/api/admin/animals/4/vet-records`);
    expect(registro.body.data[0]).toMatchObject({ id: res.body.vetRecordId, weightKg: '9.70', type: 'checkup' });
    expect(await tareaDeLaVisita(v.id)).toEqual([expect.objectContaining({ status: 'completed' })]);
  });

  it('una visita de otro día todavía no se registra', async () => {
    const res = await nuria.post('/api/admin/vet-visits/1/complete').send({
      recordDate: t.hoy,
      type: 'checkup',
      description: 'Adelantada.',
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VET_VISIT_FUTURE_DAY');
  });

  it('una visita que no existe es 404', async () => {
    expect((await marta.put('/api/admin/vet-visits/9999').send(visita())).status).toBe(404);
  });
});
