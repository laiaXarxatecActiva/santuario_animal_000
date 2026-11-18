import {
  adminDonationMonthlyQuerySchema,
  adminDonationsExportQuerySchema,
  adminDonationsQuerySchema,
  idParamsSchema,
  manualDonationSchema,
} from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { validated } from '../middlewares/validate.js';
import { sinRegistro, type ActivityLogService } from '../services/activity-log.service.js';
import type { DonationAdminService } from '../servicios/donation-admin.service.js';

// CU-39: solo llaman al caso de uso y anotan la actividad (CU-42).
export function createDonationAdminController(
  service: DonationAdminService,
  actividad: ActivityLogService = sinRegistro,
) {
  const list: RequestHandler = async (_req, res) => {
    res.json(await service.list(validated(res, 'query', adminDonationsQuerySchema)));
  };
  const monthlyTotals: RequestHandler = async (_req, res) => {
    res.json(await service.monthlyTotals(validated(res, 'query', adminDonationMonthlyQuerySchema)));
  };
  const exportCsv: RequestHandler = async (_req, res) => {
    const { filename, csv } = await service.exportCsv(validated(res, 'query', adminDonationsExportQuerySchema));
    res.type('text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  };
  const refund: RequestHandler = async (req, res) => {
    const devuelto = await service.refund(validated(res, 'params', idParamsSchema).id);
    await actividad.log(req.user!.id, 'update', 'donations', devuelto.id, {
      status: ['completed', devuelto.status],
      amount: devuelto.amount,
    });
    res.json(devuelto);
  };
  const create: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const registrado = await service.registerManual(req.user, validated(res, 'body', manualDonationSchema));
    await actividad.log(req.user.id, 'create', 'donations', registrado.id, {
      manual: true,
      method: registrado.method,
      amount: registrado.amount,
    });
    res.status(201).json(registrado);
  };
  return { list, monthlyTotals, exportCsv, refund, create };
}
