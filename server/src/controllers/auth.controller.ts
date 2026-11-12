import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, tokenSchema } from '@sanctuary/shared';
import type { Request, RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { cookieOptions, destroySession, regenerateSession, SESSION_COOKIE } from '../middlewares/session.js';
import { validated } from '../middlewares/validate.js';
import type { AuthService } from '../servicios/auth.service.js';

export const FORGOT_PASSWORD_MESSAGE = 'Si existe una cuenta con ese email, recibirás un enlace.';

// Controladores de la cuenta: llaman al caso de uso y gestionan la sesión.
export function createAuthController(service: AuthService, { secureCookies }: { secureCookies: boolean }) {
  async function iniciarSesion(req: Request, userId: number): Promise<void> {
    await regenerateSession(req);
    req.session.userId = userId;
  }

  const register: RequestHandler = async (req, res) => {
    const user = await service.register(validated(res, 'body', registerSchema));
    await iniciarSesion(req, user.id);
    res.status(201).json({ user });
  };

  const verifyEmail: RequestHandler = async (_req, res) => {
    res.json(await service.verifyEmail(validated(res, 'body', tokenSchema).token));
  };

  const resendVerification: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    await service.resendVerification(req.user.id);
    res.status(204).end();
  };

  const login: RequestHandler = async (req, res) => {
    const user = await service.login(validated(res, 'body', loginSchema));
    await iniciarSesion(req, user.id);
    res.json({ user });
  };

  const logout: RequestHandler = async (req, res) => {
    await destroySession(req);
    res.clearCookie(SESSION_COOKIE, cookieOptions(secureCookies));
    res.status(204).end();
  };

  const me: RequestHandler = (req, res) => {
    res.json({ user: req.user ?? null });
  };

  const forgotPassword: RequestHandler = async (_req, res) => {
    await service.forgotPassword(validated(res, 'body', forgotPasswordSchema).email);
    res.json({ message: FORGOT_PASSWORD_MESSAGE });
  };

  const resetPassword: RequestHandler = async (_req, res) => {
    await service.resetPassword(validated(res, 'body', resetPasswordSchema));
    res.status(204).end();
  };

  return { register, verifyEmail, resendVerification, login, logout, me, forgotPassword, resetPassword };
}
