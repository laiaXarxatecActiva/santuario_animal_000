import { changePasswordSchema, updateProfileSchema } from '@sanctuary/shared';
import type { Request, RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { validated } from '../middlewares/validate.js';
import type { ProfileService } from '../servicios/profile.service.js';

function usuario(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

// Controladores del perfil (CU-23, CU-24): solo llaman al caso de uso.
export function createProfileController(service: ProfileService) {
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

  return { get, update, changePassword };
}
