import { feedQuerySchema, updateIdParamsSchema } from '@sanctuary/shared';
import type { Request, RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { validated } from '../middlewares/validate.js';
import type { FeedService } from '../servicios/feed.service.js';

function usuarioId(req: Request): number {
  if (!req.user) throw new UnauthorizedError();
  return req.user.id;
}

// Controladores del muro (CU-17): solo llaman al caso de uso.
export function createFeedController(service: FeedService) {
  const list: RequestHandler = async (req, res) => {
    res.json(await service.list(usuarioId(req), validated(res, 'query', feedQuerySchema)));
  };

  const markRead: RequestHandler = async (req, res) => {
    await service.markRead(usuarioId(req), validated(res, 'params', updateIdParamsSchema).updateId);
    res.status(204).end();
  };

  const markUnread: RequestHandler = async (req, res) => {
    await service.markUnread(usuarioId(req), validated(res, 'params', updateIdParamsSchema).updateId);
    res.status(204).end();
  };

  return { list, markRead, markUnread };
}
