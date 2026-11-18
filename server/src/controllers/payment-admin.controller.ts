import {
  adminPaymentsExportQuerySchema,
  adminPaymentsQuerySchema,
  idParamsSchema,
  manualPaymentSchema,
} from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { validated } from '../middlewares/validate.js';
import { sinRegistro, type ActivityLogService } from '../services/activity-log.service.js';
import type { PaymentAdminService } from '../servicios/payment-admin.service.js';

// CU-38: solo llaman al caso de uso y anotan la actividad (CU-42).
export function createPaymentAdminController(
  service: PaymentAdminService,
  actividad: ActivityLogService = sinRegistro,
) {
  const list: RequestHandler = async (_req, res) => {
    res.json(await service.list(validated(res, 'query', adminPaymentsQuerySchema)));
  };
  const exportCsv: RequestHandler = async (_req, res) => {
    const { filename, csv } = await service.exportCsv(validated(res, 'query', adminPaymentsExportQuerySchema));
    res.type('text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  };
  const refund: RequestHandler = async (req, res) => {
    const devuelto = await service.refund(validated(res, 'params', idParamsSchema).id);
    await actividad.log(req.user!.id, 'update', 'payments', devuelto.id, {
      status: ['completed', devuelto.status],
      amount: devuelto.amount,
    });
    res.json(devuelto);
  };
  const create: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const registrado = await service.registerManual(req.user, validated(res, 'body', manualPaymentSchema));
    await actividad.log(req.user.id, 'create', 'payments', registrado.id, {
      manual: true,
      method: registrado.method,
      amount: registrado.amount,
    });
    res.status(201).json(registrado);
  };
  return { list, exportCsv, refund, create };
}
