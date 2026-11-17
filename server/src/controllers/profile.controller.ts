import { changePasswordSchema, deleteAccountSchema, updateProfileSchema } from '@sanctuary/shared';
import type { Request, RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { cookieOptions, destroySession, sessionCookieName } from '../middlewares/session.js';
import { validated } from '../middlewares/validate.js';
import type { ProfileService } from '../servicios/profile.service.js';

function usuario(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

// Controladores del perfil (CU-23, CU-24): solo llaman al caso de uso.
export function createProfileController(service: ProfileService, { secureCookies }: { secureCookies: boolean }) {
  const get: RequestHandler = async (req, res) => {
    res.json(await service.get(usuario(req).id));
  };

  const update: RequestHandler = async (req, res) => {
    res.json(await service.update(usuario(req), validated(res, 'body', updateProfileSchema)));
  };

  const changePassword: RequestHandler = async (req, res) => {
    await service.changePassword(usuario(req).id, req.sessionID, validated(res, 'body', changePasswordSchema));
    res.status(204).end();
  };

  /** CU-25 paso 5: tras eliminar la cuenta, se cierra la sesión y se borra la cookie. */
  const deleteAccount: RequestHandler = async (req, res) => {
    await service.deleteAccount(usuario(req).id, validated(res, 'body', deleteAccountSchema));
    await destroySession(req);
    res.clearCookie(sessionCookieName(secureCookies), cookieOptions(secureCookies));
    res.json({ message: 'Tu cuenta se ha eliminado.' });
  };

  return { get, update, changePassword, deleteAccount };
}
