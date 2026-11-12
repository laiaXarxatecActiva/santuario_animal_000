import { createAdoptionSchema, idParamsSchema, myAdoptionsQuerySchema, payAdoptionSchema } from '@sanctuary/shared';
import type { Request, RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { validated } from '../middlewares/validate.js';
import type { AdoptionService } from '../servicios/adoption.service.js';

/** Usuario de la sesión (las rutas ya exigen requireAuth). */
function usuario(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

// Controladores de las adopciones: solo llaman al caso de uso.
export function createAdoptionController(service: AdoptionService) {
  const create: RequestHandler = async (req, res) => {
    res.status(201).json(await service.create(usuario(req), validated(res, 'body', createAdoptionSchema)));
  };

  const listMine: RequestHandler = async (req, res) => {
    res.json({ data: await service.listMine(usuario(req).id, validated(res, 'query', myAdoptionsQuerySchema)) });
  };

  const pay: RequestHandler = async (req, res) => {
    const { id } = validated(res, 'params', idParamsSchema);
    const { simulatedOutcome } = validated(res, 'body', payAdoptionSchema);
    res.json(await service.pay(usuario(req).id, id, simulatedOutcome));
  };

  return { create, listMine, pay };
}
