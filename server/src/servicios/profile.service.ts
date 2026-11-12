import type { ChangePasswordInput, ProfileDto, SessionUser, UpdateProfileInput } from '@sanctuary/shared';
import type { Pool } from 'pg';
import { withTransaction } from '../db/transaction.js';
import type { Reloj } from '../dominio/reloj.js';
import { tienePreferenciasDeAdoptante } from '../dominio/usuario.js';
import {
  AdopterOnlyPreferenceError,
  InvalidCurrentPasswordError,
  NotFoundError,
  PasswordUnchangedError,
} from '../errors/app-error.js';
import * as sessionModel from '../models/session.model.js';
import * as tokenModel from '../models/user-token.model.js';
import * as userModel from '../models/user.model.js';
import { hashPassword, verifyPassword } from '../utils/passwords.js';

export interface ProfileServiceDeps {
  db: Pool;
  reloj: Reloj;
}

// CU-23 Gestionar el perfil y CU-24 Cambiar la contraseña.
export function createProfileService({ db, reloj }: ProfileServiceDeps) {
  async function get(userId: number): Promise<ProfileDto> {
    const perfil = await userModel.findProfile(db, userId);
    if (!perfil) throw new NotFoundError();
    return perfil;
  }

  /** CU-23 pasos 3-4. Las preferencias de adoptante no se aceptan de un trabajador. */
  async function update(user: SessionUser, cambios: UpdateProfileInput): Promise<ProfileDto> {
    const deAdoptante =
      cambios.showPublicName !== undefined ||
      cambios.emailNotifications !== undefined ||
      cambios.emailFrequency !== undefined;
    if (deAdoptante && !tienePreferenciasDeAdoptante(user.role)) throw new AdopterOnlyPreferenceError();
    await userModel.updateProfile(db, user.id, cambios);
    return get(user.id);
  }

  /**
   * CU-24: comprueba la actual, guarda la nueva (distinta) y, en la misma
   * transacción, cierra las demás sesiones y anula los enlaces de recuperación.
   */
  async function changePassword(
    userId: number,
    currentSid: string,
    { currentPassword, newPassword }: ChangePasswordInput,
  ): Promise<void> {
    const user = await userModel.findById(db, userId);
    if (!user) throw new NotFoundError();
    if (!(await verifyPassword(currentPassword, user.passwordHash))) throw new InvalidCurrentPasswordError();
    // bcrypt solo mira los 72 primeros bytes: dos textos distintos pueden dar la misma contraseña.
    if (await verifyPassword(newPassword, user.passwordHash)) throw new PasswordUnchangedError();
    const passwordHash = await hashPassword(newPassword);
    await withTransaction(db, async (client) => {
      await userModel.updatePassword(client, userId, passwordHash);
      await sessionModel.deleteOthersByUserId(client, userId, currentSid);
      await tokenModel.invalidateUnused(client, userId, 'password_reset', reloj.ahora());
    });
  }

  return { get, update, changePassword };
}

export type ProfileService = ReturnType<typeof createProfileService>;
