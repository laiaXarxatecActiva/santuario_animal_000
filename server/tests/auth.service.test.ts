import { describe, expect, it } from 'vitest';
import { relojFijo } from '../src/dominio/reloj.js';
import { UnauthorizedError } from '../src/errors/app-error.js';
import { createEmailService, createMemoryMailer } from '../src/services/email/email.service.js';
import { createAuthService, toSessionUser } from '../src/servicios/auth.service.js';
import { usarBaseDeDatos } from './helpers/db-fixture.js';

const db = usarBaseDeDatos();
const mailer = createMemoryMailer();
const errores: unknown[] = [];
const servicio = () =>
  createAuthService({
    db: db.pool,
    reloj: relojFijo('2026-11-12T10:00:00Z'),
    email: createEmailService({ mailer, from: 'x@santuario.test' }),
    clientUrl: 'http://localhost:5173',
    logEmailError: (error) => errores.push(error),
  });

describe('auth.service', () => {
  it('toSessionUser nunca expone el hash ni el estado interno de la cuenta', () => {
    const user = toSessionUser({
      id: 1,
      firstName: 'Marta',
      lastName: 'Soler',
      email: 'marta@santuario.test',
      passwordHash: 'secreto',
      role: 'admin',
      emailVerified: true,
      isActive: true,
      anonymizedAt: null,
    });
    expect(user).toEqual({
      id: 1,
      firstName: 'Marta',
      lastName: 'Soler',
      email: 'marta@santuario.test',
      role: 'admin',
      emailVerified: true,
    });
  });

  it('findSessionUser devuelve null para cuentas inexistentes, desactivadas o anonimizadas', async () => {
    const auth = servicio();
    expect(await auth.findSessionUser(6)).toMatchObject({ id: 6, role: 'adopter' });
    expect(await auth.findSessionUser(14)).toBeNull();
    expect(await auth.findSessionUser(15)).toBeNull();
    expect(await auth.findSessionUser(9999)).toBeNull();
  });

  it('CU-08 A1: reenviar a un usuario que ya no existe responde 401', async () => {
    await expect(servicio().resendVerification(9999)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('CU-07 5a: un fallo de envío se registra y no se propaga', async () => {
    mailer.failNext = true;
    await servicio().forgotPassword('lucia.martinez@correo.test');
    expect(errores).toHaveLength(1);
    expect(mailer.outbox).toHaveLength(0);
  });
});
