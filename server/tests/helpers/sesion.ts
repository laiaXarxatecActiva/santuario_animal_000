import type { Express } from 'express';
import request from 'supertest';
import { expect } from 'vitest';

// Usuarios de TEST_DATA.sql que usan las pruebas del panel.
export const USUARIOS = {
  marta: { email: 'marta.soler@santuario.test', password: 'MartaSoler26#!' }, // admin
  nuria: { email: 'nuria.peris@santuario.test', password: 'NuriaPeris26#!' }, // cuidadora
  andres: { email: 'andres.climent@santuario.test', password: 'AndresCliment26#!' }, // cuidador
  lucia: { email: 'lucia.martinez@correo.test', password: 'Lucia.buitres1' }, // adoptante
} as const;

export type Agente = ReturnType<typeof request.agent>;

/** Un agente con la sesión iniciada. */
export async function entrarComo(app: Express, quien: keyof typeof USUARIOS): Promise<Agente> {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send(USUARIOS[quien]);
  expect(res.status).toBe(200);
  return agent;
}
