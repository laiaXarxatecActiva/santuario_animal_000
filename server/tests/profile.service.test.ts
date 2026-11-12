import { describe, expect, it } from 'vitest';
import { relojFijo } from '../src/dominio/reloj.js';
import { AdopterOnlyPreferenceError, PasswordUnchangedError } from '../src/errors/app-error.js';
import { createProfileService } from '../src/servicios/profile.service.js';
import { hashPassword } from '../src/utils/passwords.js';
import { usarBaseDeDatos } from './helpers/db-fixture.js';

const db = usarBaseDeDatos();
const servicio = () => createProfileService({ db: db.pool, reloj: relojFijo('2026-11-12T12:00:00Z') });

describe('createProfileService', () => {
  it('CU-23: un trabajador no puede guardar preferencias de adoptante', async () => {
    const nuria = {
      id: 3,
      firstName: 'Nuria',
      lastName: 'Peris Gil',
      email: 'n@s.test',
      role: 'caretaker' as const,
      emailVerified: true,
    };
    await expect(servicio().update(nuria, { emailFrequency: 'monthly_digest' })).rejects.toBeInstanceOf(
      AdopterOnlyPreferenceError,
    );
  });

  it('CU-24: rechaza una nueva que bcrypt considera igual a la actual (más de 72 bytes)', async () => {
    const actual = 'a'.repeat(72);
    await db.pool.query('UPDATE users SET password_hash = $1 WHERE id = 7', [await hashPassword(actual)]);
    await expect(
      servicio().changePassword(7, 'sid', { currentPassword: actual, newPassword: `${actual}b` }),
    ).rejects.toBeInstanceOf(PasswordUnchangedError);
  });
});
