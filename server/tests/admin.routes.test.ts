import type { Express } from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAdminRoutes, type AdminRoutesDeps } from '../src/routes/admin.routes.js';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp } from './helpers/test-app.js';

// Criterio de aceptación de la Fase 1 (TECH_SPEC §16): todas las rutas del
// panel devuelven 401 sin sesión y 403 sin el rol adecuado.

type Metodo = 'get' | 'post' | 'put' | 'patch' | 'delete';
interface Ruta {
  metodo: Metodo;
  /** Ruta tal y como se declara en admin.routes.ts. */
  patron: string;
  /** Solo para administradores (los cuidadores reciben 403). */
  soloAdmin?: boolean;
}

const RUTAS: Ruta[] = [
  { metodo: 'get', patron: '/dashboard' },
  { metodo: 'get', patron: '/species' },
  { metodo: 'post', patron: '/species' },
  { metodo: 'put', patron: '/species/:id' },
  { metodo: 'delete', patron: '/species/:id', soloAdmin: true },
  { metodo: 'get', patron: '/animals' },
  { metodo: 'post', patron: '/animals' },
  { metodo: 'get', patron: '/animals/:id' },
  { metodo: 'put', patron: '/animals/:id' },
  { metodo: 'patch', patron: '/animals/:id/status' },
  { metodo: 'delete', patron: '/animals/:id', soloAdmin: true },
  { metodo: 'get', patron: '/animals/:id/photos' },
  { metodo: 'post', patron: '/animals/:id/photos' },
  { metodo: 'put', patron: '/animals/:id/photos/order' },
  { metodo: 'put', patron: '/animals/:id/cover' },
  { metodo: 'patch', patron: '/photos/:id' },
  { metodo: 'delete', patron: '/photos/:id' },
  { metodo: 'get', patron: '/updates' },
  { metodo: 'post', patron: '/updates' },
  { metodo: 'get', patron: '/updates/:id' },
  { metodo: 'put', patron: '/updates/:id' },
  { metodo: 'delete', patron: '/updates/:id' },
  { metodo: 'get', patron: '/animals/:id/vet-records' },
  { metodo: 'post', patron: '/animals/:id/vet-records' },
  { metodo: 'put', patron: '/vet-records/:id' },
  { metodo: 'delete', patron: '/vet-records/:id', soloAdmin: true },
  { metodo: 'get', patron: '/plans', soloAdmin: true },
  { metodo: 'post', patron: '/plans', soloAdmin: true },
  { metodo: 'put', patron: '/plans/:id', soloAdmin: true },
  { metodo: 'get', patron: '/users', soloAdmin: true },
  { metodo: 'post', patron: '/users', soloAdmin: true },
  { metodo: 'get', patron: '/users/:id', soloAdmin: true },
  { metodo: 'patch', patron: '/users/:id', soloAdmin: true },
  { metodo: 'post', patron: '/users/:id/invitation', soloAdmin: true },
  { metodo: 'post', patron: '/users/:id/logout-all', soloAdmin: true },
  { metodo: 'post', patron: '/users/:id/password-reset', soloAdmin: true },
  { metodo: 'get', patron: '/adoptions', soloAdmin: true },
  { metodo: 'post', patron: '/adoptions', soloAdmin: true },
  { metodo: 'get', patron: '/adoptions/:id', soloAdmin: true },
  { metodo: 'patch', patron: '/adoptions/:id/status', soloAdmin: true },
  { metodo: 'get', patron: '/payments', soloAdmin: true },
  { metodo: 'get', patron: '/payments/export.csv', soloAdmin: true },
  { metodo: 'post', patron: '/payments', soloAdmin: true },
  { metodo: 'post', patron: '/payments/:id/refund', soloAdmin: true },
  { metodo: 'get', patron: '/donations', soloAdmin: true },
  { metodo: 'get', patron: '/donations/export.csv', soloAdmin: true },
  { metodo: 'get', patron: '/donations/monthly-totals', soloAdmin: true },
  { metodo: 'get', patron: '/stats', soloAdmin: true },
  { metodo: 'post', patron: '/donations', soloAdmin: true },
  { metodo: 'post', patron: '/donations/:id/refund', soloAdmin: true },
  { metodo: 'get', patron: '/activity-logs', soloAdmin: true },
  { metodo: 'post', patron: '/jobs/:jobName/run', soloAdmin: true },
  { metodo: 'get', patron: '/zones' },
  { metodo: 'post', patron: '/zones', soloAdmin: true },
  { metodo: 'put', patron: '/zones/:id', soloAdmin: true },
  { metodo: 'delete', patron: '/zones/:id', soloAdmin: true },
  { metodo: 'get', patron: '/qualifications' },
  { metodo: 'post', patron: '/qualifications', soloAdmin: true },
  { metodo: 'put', patron: '/qualifications/:id', soloAdmin: true },
  { metodo: 'delete', patron: '/qualifications/:id', soloAdmin: true },
  { metodo: 'get', patron: '/users/:id/qualifications', soloAdmin: true },
  { metodo: 'put', patron: '/users/:id/qualifications', soloAdmin: true },
  { metodo: 'get', patron: '/task-templates', soloAdmin: true },
  { metodo: 'post', patron: '/task-templates', soloAdmin: true },
  { metodo: 'get', patron: '/task-templates/:id', soloAdmin: true },
  { metodo: 'put', patron: '/task-templates/:id', soloAdmin: true },
  { metodo: 'delete', patron: '/task-templates/:id', soloAdmin: true },
  { metodo: 'get', patron: '/my-day' },
  { metodo: 'get', patron: '/tasks', soloAdmin: true },
  { metodo: 'post', patron: '/tasks', soloAdmin: true },
  { metodo: 'patch', patron: '/tasks/:id/assignee', soloAdmin: true },
  { metodo: 'delete', patron: '/tasks/:id', soloAdmin: true },
  { metodo: 'post', patron: '/tasks/:id/complete' },
  { metodo: 'post', patron: '/tasks/:id/not-done' },
  { metodo: 'post', patron: '/tasks/:id/reopen' },
  { metodo: 'get', patron: '/work-settings', soloAdmin: true },
  { metodo: 'put', patron: '/work-settings', soloAdmin: true },
];

const url = (r: Ruta) => `/api/admin${r.patron.replace(':id', '1')}`;
const nombre = (r: Ruta) => `${r.metodo.toUpperCase()} ${r.patron}`;

function pedir(cliente: Agente | ReturnType<typeof request>, r: Ruta) {
  const peticion = cliente[r.metodo](url(r));
  return r.metodo === 'get' ? peticion : peticion.send({});
}

let app: Express;
let pool: Pool;
let lucia: Agente;
let nuria: Agente;
let marta: Agente;

beforeAll(async () => {
  ({ app, pool } = await prepararApp());
  lucia = await entrarComo(app, 'lucia');
  nuria = await entrarComo(app, 'nuria');
  marta = await entrarComo(app, 'marta');
});
afterAll(async () => {
  await pool.end();
});

describe('CU-27 a CU-32 Permisos del panel', () => {
  it('la lista de esta prueba contiene todas las rutas del panel', () => {
    // Si se añade una ruta a admin.routes.ts, hay que añadirla también aquí.
    const router = createAdminRoutes({} as AdminRoutesDeps);
    const declaradas = router.stack.flatMap((capa) => {
      const ruta = capa.route as { path: string; methods: Record<string, boolean> } | undefined;
      if (!ruta) return [];
      return Object.keys(ruta.methods)
        .filter((m) => m !== '_all')
        .map((m) => `${m.toUpperCase()} ${ruta.path}`);
    });
    expect(declaradas.sort()).toEqual(RUTAS.map(nombre).sort());
  });

  it.each(RUTAS.map((r) => [nombre(r), r] as const))('%s sin sesión → 401', async (_n, r) => {
    const res = await pedir(request(app), r);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it.each(RUTAS.map((r) => [nombre(r), r] as const))('%s como adoptante → 403', async (_n, r) => {
    const res = await pedir(lucia, r);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  const soloAdmin = RUTAS.filter((r) => r.soloAdmin);
  it.each(soloAdmin.map((r) => [nombre(r), r] as const))('%s como cuidadora → 403', async (_n, r) => {
    const res = await pedir(nuria, r);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  const lecturas = RUTAS.filter((r) => r.metodo === 'get' && !r.soloAdmin);
  it.each(lecturas.map((r) => [nombre(r), r] as const))('%s como cuidadora o administradora → 200', async (_n, r) => {
    expect((await pedir(nuria, r)).status).toBe(200);
    expect((await pedir(marta, r)).status).toBe(200);
  });

  const lecturasAdmin = RUTAS.filter((r) => r.metodo === 'get' && r.soloAdmin);
  it.each(lecturasAdmin.map((r) => [nombre(r), r] as const))('%s como administradora → 200', async (_n, r) => {
    expect((await pedir(marta, r)).status).toBe(200);
  });
});
