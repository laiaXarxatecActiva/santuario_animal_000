import { idParamsSchema, notificationPatchSchema, notificationsQuerySchema } from '@sanctuary/shared';
import type { Request, RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { validated } from '../middlewares/validate.js';
import type { NotificationService } from '../servicios/notification.service.js';

function usuarioId(req: Request): number {
  if (!req.user) throw new UnauthorizedError();
  return req.user.id;
}

// Controladores de la campana (CU-18): solo llaman al caso de uso.
export function createNotificationController(service: NotificationService) {
  const list: RequestHandler = async (req, res) => {
    res.json(await service.list(usuarioId(req), validated(res, 'query', notificationsQuerySchema)));
  };

  const update: RequestHandler = async (req, res) => {
    const { id } = validated(res, 'params', idParamsSchema);
    const { isRead } = validated(res, 'body', notificationPatchSchema);
    res.json(await service.setRead(usuarioId(req), id, isRead));
  };

  const readAll: RequestHandler = async (req, res) => {
    await service.markAllRead(usuarioId(req));
    res.status(204).end();
  };

  const remove: RequestHandler = async (req, res) => {
    await service.remove(usuarioId(req), validated(res, 'params', idParamsSchema).id);
    res.status(204).end();
  };

  const removeAll: RequestHandler = async (req, res) => {
    await service.removeAll(usuarioId(req));
    res.status(204).end();
  };

  return { list, update, readAll, remove, removeAll };
}
