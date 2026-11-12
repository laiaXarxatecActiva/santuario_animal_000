import type {
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  SessionUser,
  UserTokenType,
  VerifyEmailResponse,
} from '@sanctuary/shared';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { Queryable } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import type { Reloj } from '../dominio/reloj.js';
import { caducidadToken, estadoToken } from '../dominio/token.js';
import { cuentaActiva } from '../dominio/usuario.js';
import {
  AccountInactiveError,
  EmailAlreadyRegisteredError,
  EmailAlreadyVerifiedError,
  InvalidCredentialsError,
  InvalidTokenError,
  UnauthorizedError,
} from '../errors/app-error.js';
import * as sessionModel from '../models/session.model.js';
import * as tokenModel from '../models/user-token.model.js';
import * as userModel from '../models/user.model.js';
import type { EmailMessage, EmailService } from '../services/email/email.service.js';
import { resetPasswordEmail } from '../services/email/templates/reset-password.js';
import { verifyEmailEmail } from '../services/email/templates/verify-email.js';
import { hashPassword, verifyPassword } from '../utils/passwords.js';
import { generarToken, hashToken } from '../utils/tokens.js';

export interface AuthServiceDeps {
  db: Pool;
  reloj: Reloj;
  email: EmailService;
  /** URL del cliente, para los enlaces de los emails. */
  clientUrl: string;
  /** Registra los fallos de envío de email (nunca deshacen la operación). */
  logEmailError?: (error: unknown) => void;
}

export function toSessionUser(user: userModel.User): SessionUser {
  const { id, firstName, lastName, email, role, emailVerified } = user;
  return { id, firstName, lastName, email, role, emailVerified };
}

// Casos de uso de la cuenta: CU-07, CU-08, CU-09 y CU-10. CU-11 (cerrar sesión)
// solo destruye la sesión y lo resuelve el controlador.
export function createAuthService({ db, reloj, email, clientUrl, logEmailError = () => {} }: AuthServiceDeps) {
  // Hash con el que se compara cuando el email no existe, para que la
  // respuesta tarde lo mismo y no revele qué cuentas existen.
  let hashFalso: Promise<string> | undefined;

  async function enviar(mensaje: EmailMessage): Promise<void> {
    try {
      await email.send(mensaje);
    } catch (error) {
      logEmailError(error);
    }
  }

  function enlace(ruta: string, token: string): string {
    const url = new URL(ruta, clientUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  async function crearToken(q: Queryable, userId: number, type: UserTokenType): Promise<string> {
    const { token, hash } = generarToken();
    await tokenModel.create(q, { userId, type, tokenHash: hash, expiresAt: caducidadToken(type, reloj.ahora()) });
    return token;
  }

  /** Invalida los enlaces anteriores del mismo tipo y crea uno nuevo. */
  function sustituirToken(userId: number, type: UserTokenType): Promise<string> {
    return withTransaction(db, async (client) => {
      await tokenModel.invalidateUnused(client, userId, type, reloj.ahora());
      return crearToken(client, userId, type);
    });
  }

  async function enviarVerificacion(user: userModel.User, token: string): Promise<void> {
    const contenido = verifyEmailEmail({ firstName: user.firstName, url: enlace('/verify-email', token) });
    await enviar({ to: user.email, ...contenido });
  }

  /** Token válido del tipo indicado o InvalidTokenError (caducado, usado, inexistente o de otro tipo). */
  async function tokenValido(token: string, type: UserTokenType): Promise<tokenModel.UserToken> {
    const encontrado = await tokenModel.findByHash(db, hashToken(token));
    if (!encontrado || encontrado.type !== type || estadoToken(encontrado, reloj.ahora()) !== 'valid') {
      throw new InvalidTokenError();
    }
    return encontrado;
  }

  /** CU-07: crea el adoptante y su token de verificación, y envía el email. */
  async function register(datos: RegisterInput): Promise<SessionUser> {
    if (await userModel.findByEmail(db, datos.email)) throw new EmailAlreadyRegisteredError();
    const passwordHash = await hashPassword(datos.password);
    const { user, token } = await withTransaction(db, async (client) => {
      const creado = await userModel.create(client, {
        firstName: datos.firstName,
        lastName: datos.lastName,
        email: datos.email,
        passwordHash,
        privacyAcceptedAt: reloj.ahora(),
      });
      return { user: creado, token: await crearToken(client, creado.id, 'email_verification') };
    });
    await enviarVerificacion(user, token);
    return toSessionUser(user);
  }

  /** CU-08. Si el email ya estaba verificado lo indica, aunque el enlace se haya usado. */
  async function verifyEmail(token: string): Promise<VerifyEmailResponse> {
    const encontrado = await tokenModel.findByHash(db, hashToken(token));
    if (encontrado?.type === 'email_verification') {
      const user = await userModel.findById(db, encontrado.userId);
      if (user?.emailVerified) return { status: 'already_verified' };
    }

    const valido = await tokenValido(token, 'email_verification');
    await withTransaction(db, async (client) => {
      if (!(await tokenModel.markUsed(client, valido.id, reloj.ahora()))) throw new InvalidTokenError();
      await userModel.markEmailVerified(client, valido.userId);
    });
    return { status: 'verified' };
  }

  /** CU-08 A1: invalida los tokens anteriores y envía uno nuevo. */
  async function resendVerification(userId: number): Promise<void> {
    const user = await userModel.findById(db, userId);
    if (!user) throw new UnauthorizedError();
    if (user.emailVerified) throw new EmailAlreadyVerifiedError();
    const token = await sustituirToken(user.id, 'email_verification');
    await enviarVerificacion(user, token);
  }

  /** CU-09: comprueba las credenciales y guarda el último acceso. */
  async function login({ email: correo, password }: LoginInput): Promise<SessionUser> {
    const user = await userModel.findByEmail(db, correo);
    hashFalso ??= hashPassword(randomUUID());
    const correcta = await verifyPassword(password, user?.passwordHash ?? (await hashFalso));
    if (!user || !correcta) throw new InvalidCredentialsError();
    if (!cuentaActiva(user)) throw new AccountInactiveError();
    await userModel.updateLastLogin(db, user.id, reloj.ahora());
    return toSessionUser(user);
  }

  /** CU-10 pasos 1-3. No revela si la cuenta existe: quien llama responde siempre igual. */
  async function forgotPassword(correo: string): Promise<void> {
    const user = await userModel.findByEmail(db, correo);
    if (!user || !cuentaActiva(user)) return;
    const token = await sustituirToken(user.id, 'password_reset');
    const contenido = resetPasswordEmail({ firstName: user.firstName, url: enlace('/reset-password', token) });
    await enviar({ to: user.email, ...contenido });
  }

  /** CU-10 pasos 4-5: nueva contraseña, token usado y todas las sesiones cerradas. */
  async function resetPassword({ token, password }: ResetPasswordInput): Promise<void> {
    const valido = await tokenValido(token, 'password_reset');
    const user = await userModel.findById(db, valido.userId);
    if (!user || !cuentaActiva(user)) throw new InvalidTokenError();
    const passwordHash = await hashPassword(password);
    await withTransaction(db, async (client) => {
      if (!(await tokenModel.markUsed(client, valido.id, reloj.ahora()))) throw new InvalidTokenError();
      await tokenModel.invalidateUnused(client, user.id, 'password_reset', reloj.ahora());
      await userModel.updatePassword(client, user.id, passwordHash);
      await sessionModel.deleteByUserId(client, user.id);
    });
  }

  /** Usuario de la sesión, o `null` si ya no existe o su cuenta no está activa. */
  async function findSessionUser(id: number): Promise<SessionUser | null> {
    const user = await userModel.findById(db, id);
    return user && cuentaActiva(user) ? toSessionUser(user) : null;
  }

  return { register, verifyEmail, resendVerification, login, forgotPassword, resetPassword, findSessionUser };
}

export type AuthService = ReturnType<typeof createAuthService>;
