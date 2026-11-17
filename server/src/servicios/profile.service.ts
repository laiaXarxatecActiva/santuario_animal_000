import { randomBytes } from 'node:crypto';
import type { ChangePasswordInput, DeleteAccountInput, ProfileDto, SessionUser, UpdateProfileInput } from '@sanctuary/shared';
import type { Pool } from 'pg';
import { withTransaction } from '../db/transaction.js';
import type { Reloj } from '../dominio/reloj.js';
import { datosAnonimizados, puedeEliminarCuenta, tienePreferenciasDeAdoptante } from '../dominio/usuario.js';
import {
  AdopterOnlyPreferenceError,
  ForbiddenError,
  InvalidCurrentPasswordError,
  InvalidPasswordError,
  NotFoundError,
  PasswordUnchangedError,
} from '../errors/app-error.js';
import * as adoptionModel from '../models/adoption.model.js';
import * as donationModel from '../models/donation.model.js';
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
    if (await verifyPassword(newPassword, user.passwordHash)) throw new PasswordUnchangedError();
    const passwordHash = await hashPassword(newPassword);
    await withTransaction(db, async (client) => {
      await userModel.updatePassword(client, userId, passwordHash);
      await sessionModel.deleteOthersByUserId(client, userId, currentSid);
      await tokenModel.invalidateUnused(client, userId, 'password_reset', reloj.ahora());
    });
  }

  /**
   * CU-25: comprueba la contraseña y, en una transacción, cierra las adopciones
   * abiertas, anonimiza al usuario, vacía sus donaciones y borra lo personal y
   * todas sus sesiones (RN-20). Los pagos y los importes se conservan.
   */
  async function deleteAccount(userId: number, { password }: DeleteAccountInput): Promise<void> {
    const user = await userModel.findById(db, userId);
    if (!user) throw new NotFoundError();
    if (!puedeEliminarCuenta(user.role)) throw new ForbiddenError();
    if (!(await verifyPassword(password, user.passwordHash))) throw new InvalidPasswordError();
    // Contraseña aleatoria que nadie conoce: la cuenta no vuelve a servir para entrar.
    const passwordHash = await hashPassword(randomBytes(32).toString('base64url'));
    await withTransaction(db, async (client) => {
      await adoptionModel.closeOpenForUser(client, userId, reloj.hoy());
      await userModel.anonymize(client, userId, { ...datosAnonimizados(userId), passwordHash, instante: reloj.ahora() });
      await donationModel.clearDonorData(client, userId);
      await userModel.deletePersonalRecords(client, userId);
      await sessionModel.deleteByUserId(client, userId);
    });
  }

  return { get, update, changePassword, deleteAccount };
}

export type ProfileService = ReturnType<typeof createProfileService>;
