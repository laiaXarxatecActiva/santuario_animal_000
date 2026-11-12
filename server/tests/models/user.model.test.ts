import { describe, expect, it } from 'vitest';
import { EmailAlreadyRegisteredError } from '../../src/errors/app-error.js';
import {
  create,
  findByEmail,
  findById,
  mapRow,
  markEmailVerified,
  updateLastLogin,
  updatePassword,
} from '../../src/models/user.model.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

const db = usarBaseDeDatos();

const nuevo = {
  firstName: 'Ana',
  lastName: 'Ferrer',
  email: 'ana.ferrer@correo.test',
  passwordHash: '$2a$10$hash',
  privacyAcceptedAt: new Date('2026-11-12T10:00:00Z'),
};

describe('user.model', () => {
  it('mapRow pasa a camelCase', () => {
    expect(
      mapRow({
        id: 6,
        first_name: 'Lucía',
        last_name: 'Martínez',
        email: 'lucia@correo.test',
        password_hash: 'h',
        role: 'adopter',
        email_verified: true,
        is_active: true,
        anonymized_at: null,
      }),
    ).toEqual({
      id: 6,
      firstName: 'Lucía',
      lastName: 'Martínez',
      email: 'lucia@correo.test',
      passwordHash: 'h',
      role: 'adopter',
      emailVerified: true,
      isActive: true,
      anonymizedAt: null,
    });
  });

  it('busca por email sin distinguir mayúsculas', async () => {
    const lucia = await findByEmail(db.pool, 'Lucia.MARTINEZ@correo.test');
    expect(lucia).toMatchObject({ id: 6, firstName: 'Lucía', role: 'adopter', emailVerified: true });
    expect(await findByEmail(db.pool, 'nadie@correo.test')).toBeNull();
  });

  it('busca por id', async () => {
    expect(await findById(db.pool, 3)).toMatchObject({ email: 'nuria.peris@santuario.test', role: 'caretaker' });
    expect(await findById(db.pool, 9999)).toBeNull();
  });

  it('CU-07 crea un adoptante sin verificar con la fecha de aceptación de la privacidad', async () => {
    const ana = await create(db.pool, nuevo);
    expect(ana).toMatchObject({
      email: 'ana.ferrer@correo.test',
      role: 'adopter',
      emailVerified: false,
      isActive: true,
    });
    const { rows } = await db.pool.query('SELECT privacy_accepted_at FROM users WHERE id = $1', [ana.id]);
    expect(rows[0].privacy_accepted_at.toISOString()).toBe('2026-11-12T10:00:00.000Z');
  });

  it('CU-07 3a: un email repetido (con otras mayúsculas) da EmailAlreadyRegisteredError', async () => {
    await expect(create(db.pool, { ...nuevo, email: 'LUCIA.martinez@correo.test' })).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );
  });

  it('CU-08 marca el email como verificado', async () => {
    await markEmailVerified(db.pool, 13);
    expect((await findById(db.pool, 13))?.emailVerified).toBe(true);
  });

  it('CU-10 cambia el hash de la contraseña', async () => {
    await updatePassword(db.pool, 7, 'nuevo-hash');
    expect((await findById(db.pool, 7))?.passwordHash).toBe('nuevo-hash');
  });

  it('CU-09 guarda el último acceso', async () => {
    await updateLastLogin(db.pool, 6, new Date('2026-11-12T09:30:00Z'));
    const { rows } = await db.pool.query('SELECT last_login_at FROM users WHERE id = 6');
    expect(rows[0].last_login_at.toISOString()).toBe('2026-11-12T09:30:00.000Z');
  });
});
