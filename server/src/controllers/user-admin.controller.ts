import {
  adminUserAnonymizeSchema,
  adminUserDeleteSchema,
  adminUserLogoutAllSchema,
  adminUserPatchSchema,
  adminUsersQuerySchema,
  idParamsSchema,
  workerCreateSchema,
  type AdminUserLogoutAllDto,
} from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { cambio } from '../dominio/actividad.js';
import { validated } from '../middlewares/validate.js';
import { sinRegistro, type ActivityLogService } from '../services/activity-log.service.js';
import type { UserAdminService } from '../servicios/user-admin.service.js';

// CU-35, CU-36 y CU-48: solo llaman al caso de uso y anotan la actividad (CU-42).
export function createUserAdminController(service: UserAdminService, actividad: ActivityLogService = sinRegistro) {
  const id = (res: Parameters<RequestHandler>[1]) => validated(res, 'params', idParamsSchema).id;

  const list: RequestHandler = async (_req, res) => {
    res.json(await service.list(validated(res, 'query', adminUsersQuerySchema)));
  };
  const get: RequestHandler = async (_req, res) => {
    res.json(await service.get(id(res)));
  };
  const update: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const antes = await service.get(id(res));
    const usuario = await service.update(req.user.id, id(res), validated(res, 'body', adminUserPatchSchema));
    await actividad.log(req.user.id, 'update', 'users', usuario.id, {
      status: cambio(antes.status, usuario.status),
      role: cambio(antes.role, usuario.role),
    });
    res.json(usuario);
  };
  const create: RequestHandler = async (req, res) => {
    const trabajador = await service.createWorker(validated(res, 'body', workerCreateSchema));
    await actividad.log(req.user!.id, 'create', 'users', trabajador.id, { role: trabajador.role });
    res.status(201).json(trabajador);
  };
  const resendInvitation: RequestHandler = async (req, res) => {
    await service.resendInvitation(id(res));
    await actividad.log(req.user!.id, 'update', 'users', id(res), { invitationResent: true });
    res.status(204).end();
  };
  /** CU-48: el motivo se guarda en el registro de actividad, nunca en la cuenta. */
  const logoutAll: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const { reason } = validated(res, 'body', adminUserLogoutAllSchema);
    const closedSessions = await service.logoutAll({ id: req.user.id, sid: req.sessionID }, id(res));
    await actividad.log(req.user.id, 'update', 'users', id(res), { sessionsClosed: closedSessions, reason });
    const respuesta: AdminUserLogoutAllDto = { closedSessions };
    res.json(respuesta);
  };
  // CU-51: el registro de actividad anota el envío, nunca el enlace. La clave no
  // lleva «password» porque `limpiarDetalles` descarta esas claves (CU-42).
  const sendPasswordReset: RequestHandler = async (req, res) => {
    await service.sendPasswordReset(req.user!.id, id(res));
    await actividad.log(req.user!.id, 'update', 'users', id(res), { resetLinkSent: true });
    res.status(204).end();
  };

  /** CU-75 paso 2. */
  const linkedData: RequestHandler = async (_req, res) => {
    res.json(await service.linkedData(id(res)));
  };
  /** CU-75: el motivo (opcional) queda en el registro de actividad. */
  const remove: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const { reason, force } = validated(res, 'body', adminUserDeleteSchema);
    await service.deleteAccount(req.user.id, id(res), { force });
    await actividad.log(req.user.id, 'delete', 'users', id(res), reason ? { reason } : null);
    res.status(204).end();
  };
  /** CU-76. */
  const anonymize: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const { reason } = validated(res, 'body', adminUserAnonymizeSchema);
    const usuario = await service.anonymize(req.user.id, id(res));
    await actividad.log(req.user.id, 'update', 'users', usuario.id, {
      anonymized: true,
      ...(reason ? { reason } : {}),
    });
    res.json(usuario);
  };

  return { list, get, update, create, resendInvitation, logoutAll, sendPasswordReset, linkedData, remove, anonymize };
}
