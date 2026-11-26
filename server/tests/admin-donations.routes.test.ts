import type { AdminDonationListItemDto, AdminDonationMonthlyTotalsDto, AdminDonationsPage } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
let marta: Agente;
beforeAll(async () => {
  t = await prepararApp();
  marta = await entrarComo(t.app, 'marta');
});
afterAll(() => t.pool.end());
beforeEach(() => {
  t.mailer.outbox.length = 0;
});

const DIA = "(COALESCE(paid_at, created_at) AT TIME ZONE 'Europe/Madrid')::date";
const listar = async (query: Record<string, string | number> = {}): Promise<AdminDonationsPage> => {
  const res = await marta.get('/api/admin/donations').query({ pageSize: 100, ...query });
  expect(res.status).toBe(200);
  return res.body;
};
const ids = async (query: Record<string, string | number>) =>
  (await listar(query)).data.map((d) => d.id).sort((a, b) => a - b);
const idsSql = async (where: string, params: unknown[] = []) =>
  (await t.pool.query<{ id: number }>(`SELECT id FROM donations WHERE ${where} ORDER BY id`, params)).rows.map(
    (r) => r.id,
  );
const sumaSql = async (where: string, params: unknown[] = []) =>
  (
    await t.pool.query<{ suma: string }>(
      `SELECT COALESCE(sum(amount), 0)::numeric(12,2)::text AS suma FROM donations
        WHERE status = 'completed' AND ${where}`,
      params,
    )
  ).rows[0]?.suma;
const donacion = async (id: number) =>
  (
    await t.pool.query(
      `SELECT user_id, donor_name, donor_email, amount, is_anonymous, message, method, status,
              payment_reference, recorded_by, refunded_at,
              (paid_at AT TIME ZONE 'Europe/Madrid')::date::text AS dia
         FROM donations WHERE id = $1`,
      [id],
    )
  ).rows[0];
const restarDias = (dia: string, n: number) => {
  const fecha = new Date(`${dia}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() - n);
  return fecha.toISOString().slice(0, 10);
};

describe('CU-39 Gestionar donaciones: acceso', () => {
  it('solo el administrador: sin sesión 401; cuidadora y adoptante 403', async () => {
    expect((await request(t.app).get('/api/admin/donations')).status).toBe(401);
    for (const quien of ['nuria', 'lucia'] as const) {
      const agente = await entrarComo(t.app, quien);
      expect((await agente.get('/api/admin/donations')).status).toBe(403);
      expect((await agente.get('/api/admin/donations/export.csv')).status).toBe(403);
      expect((await agente.get('/api/admin/donations/monthly-totals')).status).toBe(403);
      expect((await agente.post('/api/admin/donations').send({})).status).toBe(403);
      expect((await agente.post('/api/admin/donations/1/refund').send({})).status).toBe(403);
    }
  });
});

describe('CU-39 Gestionar donaciones: listado', () => {
  it('2: lista las donaciones con donante, importe, mensaje, método y estado', async () => {
    const { data, meta } = await listar();
    expect(meta.total).toBe((await idsSql('TRUE')).length);
    const hucha = data.find((d) => d.id === 6) as AdminDonationListItemDto;
    expect(hucha).toEqual({
      id: 6,
      userId: null,
      donorName: 'CEIP Els Ports (semana solidaria)',
      donorEmail: null,
      isAnonymous: false,
      amount: '87.40',
      message: 'Recaudado por el alumnado en la semana solidaria.',
      method: 'bank_transfer',
      status: 'completed',
      reference: 'TRF-D0006',
      date: expect.any(String),
      refundedAt: null,
      failureReason: null,
      recordedBy: { id: 1, name: 'Marta Soler Ferrer' },
    });
  });

  it('2: el administrador ve marcadas las anónimas, con el nombre si se dio', async () => {
    const { data } = await listar();
    const pablo = data.find((d) => d.id === 5) as AdminDonationListItemDto;
    expect(pablo).toMatchObject({ isAnonymous: true, donorName: 'Pablo García Esteve', userId: 7 });
    expect(data.find((d) => d.id === 2)).toMatchObject({ isAnonymous: true, donorName: null, donorEmail: null });
  });

  it('2: ordena por fecha, de la más reciente a la más antigua', async () => {
    const fechas = (await listar()).data.map((d) => d.date);
    expect(fechas).toEqual([...fechas].sort().reverse());
    expect((await listar({ sort: '-amount' })).data[0]?.id).toBe(7);
  });

  it('2: filtra por estado y por forma de pago', async () => {
    expect(await ids({ status: 'completed' })).toEqual(await idsSql("status = 'completed'"));
    expect(await ids({ status: 'refunded' })).toEqual([9]);
    // Las dos registradas a mano son transferencias; las demás, con tarjeta en la web.
    expect(await ids({ method: 'bank_transfer' })).toEqual([6, 7]);
    expect(await ids({ method: 'card' })).toEqual(await idsSql("method = 'card'"));
  });

  it('2: filtra por fechas (día del cobro o del intento, en la zona del santuario)', async () => {
    const desde = restarDias(t.hoy, 20);
    const hasta = restarDias(t.hoy, 2);
    expect(await ids({ from: desde, to: hasta })).toEqual(
      await idsSql(`${DIA} BETWEEN $1::date AND $2::date`, [desde, hasta]),
    );
    expect(await ids({ from: desde })).toEqual(await idsSql(`${DIA} >= $1::date`, [desde]));
  });

  it('2: busca por donante (nombre o email), sin distinguir tildes ni mayúsculas', async () => {
    expect(await ids({ q: 'lucia' })).toEqual([1, 12]);
    expect(await ids({ q: 'RAPACES' })).toEqual([7]);
    expect(await ids({ q: 'familia.roig@' })).toEqual([3]);
    expect(await ids({ q: '100%' })).toEqual([]);
  });

  it('2: la fecha final no puede ser anterior a la inicial', async () => {
    const res = await marta.get('/api/admin/donations').query({ from: '2026-05-01', to: '2026-04-01' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ field: 'to' })]);
  });

  it('suma lo cobrado con los filtros (sin fallidas, pendientes ni devueltas)', async () => {
    expect((await listar()).totalCollected).toBe(await sumaSql('TRUE'));
    expect((await listar({ method: 'card' })).totalCollected).toBe(await sumaSql("method = 'card'"));
    expect((await listar({ status: 'failed' })).totalCollected).toBe('0.00');
    expect((await listar({ q: 'rapaces' })).totalCollected).toBe('250.00');
  });
});

describe('CU-39 Gestionar donaciones: total por mes (paso 3)', () => {
  const totales = async (query: Record<string, string> = {}): Promise<AdminDonationMonthlyTotalsDto> => {
    const res = await marta.get('/api/admin/donations/monthly-totals').query(query);
    expect(res.status).toBe(200);
    return res.body;
  };
  const mesSql = (mes: string, extra = 'TRUE', params: unknown[] = []) =>
    sumaSql(`to_char(${DIA}, 'YYYY-MM') = $${params.length + 1} AND ${extra}`, [...params, mes]);

  it('sin fechas: los últimos 12 meses, también los que no tienen donaciones', async () => {
    const { data } = await totales();
    expect(data).toHaveLength(12);
    expect(data.at(-1)?.month).toBe(t.hoy.slice(0, 7));
    for (const fila of data) expect(fila.total).toBe(await mesSql(fila.month));
    expect(data.some((fila) => fila.total === '0.00' && fila.count === 0)).toBe(true);
  });

  it('cuenta las donaciones cobradas de cada mes', async () => {
    const { data } = await totales();
    for (const fila of data) {
      const [{ n }] = (
        await t.pool.query(
          `SELECT count(*)::int AS n FROM donations WHERE status = 'completed' AND to_char(${DIA}, 'YYYY-MM') = $1`,
          [fila.month],
        )
      ).rows;
      expect(fila.count).toBe(n);
    }
  });

  it('respeta «desde», «hasta», la forma de pago y la búsqueda', async () => {
    const desde = restarDias(t.hoy, 70);
    const { data } = await totales({ from: desde, to: t.hoy, method: 'card' });
    expect(data[0]?.month).toBe(desde.slice(0, 7));
    expect(data.at(-1)?.month).toBe(t.hoy.slice(0, 7));
    for (const fila of data) {
      expect(fila.total).toBe(
        await mesSql(fila.month, `method = 'card' AND ${DIA} BETWEEN $1::date AND $2::date`, [desde, t.hoy]),
      );
    }

    const asociacion = await totales({ q: 'rapaces' });
    expect(asociacion.data.reduce((n, fila) => n + fila.count, 0)).toBe(1);
  });

  it('valida las fechas', async () => {
    expect((await marta.get('/api/admin/donations/monthly-totals').query({ from: 'ayer' })).status).toBe(400);
  });
});

describe('CU-39 Gestionar donaciones: exportación CSV (paso 4)', () => {
  it('descarga las donaciones filtradas para hoja de cálculo', async () => {
    const res = await marta.get('/api/admin/donations/export.csv').query({ method: 'bank_transfer' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="donaciones-${t.hoy}.csv"`);
    const lineas = res.text.replace(/^\uFEFF/, '').split('\r\n');
    expect(lineas[0]).toBe(
      'Fecha;Referencia;Donante;Email;Anónima;Importe;Forma de pago;Estado;Mensaje;Devuelto el;Registrado por',
    );
    const [{ dia }] = (await t.pool.query(`SELECT to_char(${DIA}, 'DD/MM/YYYY') AS dia FROM donations WHERE id = 6`))
      .rows;
    // De la más reciente a la más antigua: la 7 y la 6.
    expect(lineas[1]).toMatch(/^\d{2}\/\d{2}\/\d{4};TRF-D0007;Asociación Amigos de las Rapaces;/);
    expect(lineas[2]).toBe(
      `${dia};TRF-D0006;CEIP Els Ports (semana solidaria);;No;87,40;Transferencia;Cobrada;` +
        'Recaudado por el alumnado en la semana solidaria.;;Marta Soler Ferrer',
    );
    expect(lineas).toHaveLength(4);
    expect(lineas[3]).toBe('');
  });

  it('las anónimas y las devueltas', async () => {
    const res = await marta.get('/api/admin/donations/export.csv').query({ q: 'sergio' });
    const lineas = res.text.replace(/^\uFEFF/, '').split('\r\n');
    const [{ devuelta }] = (
      await t.pool.query(
        "SELECT to_char((refunded_at AT TIME ZONE 'Europe/Madrid')::date, 'DD/MM/YYYY') AS devuelta FROM donations WHERE id = 9",
      )
    ).rows;
    expect(lineas[1]).toMatch(new RegExp(`;Devuelta;;${devuelta};$`));

    const anonimas = await marta.get('/api/admin/donations/export.csv').query({ q: 'pablo' });
    expect(anonimas.text).toContain(';Pablo García Esteve;pablo.garcia@correo.test;Sí;100,00;Tarjeta;Cobrada;');
  });
});

describe('CU-39 A1 Registrar una donación manual', () => {
  it('la guarda como cobrada, con el administrador que la registra, y envía el agradecimiento', async () => {
    const res = await marta.post('/api/admin/donations').send({
      amount: '25,50',
      date: t.hoy,
      method: 'bank_transfer',
      donorName: 'Ana Ruiz',
      donorEmail: 'ana.ruiz@correo.test',
      isAnonymous: false,
      message: 'En el mercadillo solidario.',
    });
    expect(res.status).toBe(201);
    const creada = res.body as AdminDonationListItemDto;
    expect(creada).toMatchObject({
      userId: null,
      donorName: 'Ana Ruiz',
      donorEmail: 'ana.ruiz@correo.test',
      isAnonymous: false,
      amount: '25.50',
      message: 'En el mercadillo solidario.',
      method: 'bank_transfer',
      status: 'completed',
      recordedBy: { id: 1, name: 'Marta Soler Ferrer' },
    });
    expect(creada.reference).toMatch(/^TRF-\d{8}-[0-9A-F]{10}$/);
    expect(await donacion(creada.id)).toMatchObject({ dia: t.hoy, recorded_by: 1, user_id: null });

    const [email] = t.mailer.outbox;
    expect(t.mailer.outbox).toHaveLength(1);
    expect(email).toMatchObject({ to: 'ana.ruiz@correo.test', subject: '¡Gracias por tu donación!' });
    expect(email?.text).toContain('Importe: 25,50');
    expect(email?.text).toContain(`Referencia: ${creada.reference}`);
    expect(email?.text).not.toContain('simulado');
  });

  it('con una fecha anterior queda en ese día (una transferencia que llegó tarde)', async () => {
    const dia = restarDias(t.hoy, 10);
    const res = await marta
      .post('/api/admin/donations')
      .send({ amount: '40', date: dia, method: 'bank_transfer', isAnonymous: true });
    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^TRF-/);
    expect(await donacion(res.body.id)).toMatchObject({
      dia,
      is_anonymous: true,
      donor_name: null,
      donor_email: null,
      method: 'bank_transfer',
    });
    expect(await ids({ from: dia, to: dia })).toContain(res.body.id);
    // Sin email no se envía nada.
    expect(t.mailer.outbox).toHaveLength(0);
  });

  it('no admite una fecha futura ni un día inexistente', async () => {
    const futura = await marta
      .post('/api/admin/donations')
      .send({ amount: '5', date: '2999-01-01', method: 'bank_transfer', isAnonymous: false });
    expect(futura.status).toBe(400);
    expect(futura.body.error.details).toEqual([{ field: 'date', message: 'La fecha no puede ser posterior a hoy.' }]);
    const inexistente = await marta
      .post('/api/admin/donations')
      .send({ amount: '5', date: '2025-02-30', method: 'bank_transfer', isAnonymous: false });
    expect(inexistente.status).toBe(400);
    expect(inexistente.body.error.details).toEqual([{ field: 'date', message: 'Esta fecha no existe.' }]);
  });

  it('no se registran donaciones en efectivo', async () => {
    const res = await marta
      .post('/api/admin/donations')
      .send({ amount: '5', date: t.hoy, method: 'cash', isAnonymous: false });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ field: 'method' })]);
  });

  it('valida importe, forma de pago, fecha y email', async () => {
    const res = await marta
      .post('/api/admin/donations')
      .send({ amount: '0', date: '', method: 'card', donorEmail: 'no-es-un-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual([
      'amount',
      'date',
      'donorEmail',
      'method',
    ]);
  });
});

describe('CU-39 A2 Devolver una donación', () => {
  it('una de la web pasa a devuelta y se avisa al donante (campana y email)', async () => {
    const res = await marta.post('/api/admin/donations/1/refund').send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, status: 'refunded', refundedAt: expect.any(String) });
    expect(await donacion(1)).toMatchObject({ status: 'refunded', refunded_at: expect.any(Date) });

    const [aviso] = (
      await t.pool.query('SELECT type, message, link FROM notifications WHERE user_id = 6 ORDER BY id DESC LIMIT 1')
    ).rows;
    expect(aviso).toEqual({
      type: 'system',
      message: expect.stringMatching(/^Te hemos devuelto tu donación de 20,00\s€\.$/),
      link: '/my-contributions',
    });

    expect(t.mailer.outbox).toHaveLength(1);
    expect(t.mailer.outbox[0]).toMatchObject({
      to: 'lucia.martinez@correo.test',
      subject: 'Te hemos devuelto tu donación',
    });
    expect(t.mailer.outbox[0]?.text).toContain('por el mismo medio');
  });

  it('sin cuenta ni email no hay a quién avisar', async () => {
    const antes = (await t.pool.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n;
    const res = await marta.post('/api/admin/donations/6/refund').send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('refunded');
    expect(t.mailer.outbox).toHaveLength(0);
    expect((await t.pool.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n).toBe(antes);
  });

  it('con email pero sin cuenta: solo el email; por transferencia, se devuelve a mano', async () => {
    const res = await marta.post('/api/admin/donations/7/refund').send({});
    expect(res.status).toBe(200);
    expect(t.mailer.outbox).toHaveLength(1);
    expect(t.mailer.outbox[0]?.to).toBe('contacto@amigosrapaces.test');
    expect(t.mailer.outbox[0]?.text).toContain('nos pondremos en contacto contigo');
  });

  it('solo se devuelve una donación cobrada', async () => {
    for (const id of [8, 9, 10, 1]) {
      const res = await marta.post(`/api/admin/donations/${id}/refund`).send({});
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('DONATION_NOT_REFUNDABLE');
    }
    expect((await marta.post('/api/admin/donations/999/refund').send({})).status).toBe(404);
  });
});

describe('CU-39 y CU-05 Apellidos del donante en el panel', () => {
  it('el listado muestra el nombre con los apellidos y se puede buscar por ellos', async () => {
    const res = await request(t.app).post('/api/donations').send({
      amount: '4',
      donorName: 'Iris',
      donorSurname: 'Valls Mora',
      donorEmail: 'iris.valls@correo.test',
      acceptPrivacy: true,
    });
    expect(res.status).toBe(201);
    const fila = (await listar({ q: 'valls mora' })).data;
    expect(fila.map((d) => [d.id, d.donorName])).toEqual([[res.body.id, 'Iris Valls Mora']]);
  });
});
