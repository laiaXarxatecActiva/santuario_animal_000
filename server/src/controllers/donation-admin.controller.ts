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
import type { DonationAdminService } from '../servicios/donation-admin.service.js';

// CU-39: solo llaman al caso de uso.
export function createDonationAdminController(service: DonationAdminService) {
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
  const refund: RequestHandler = async (_req, res) => {
    res.json(await service.refund(validated(res, 'params', idParamsSchema).id));
  };
  const create: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    res.status(201).json(await service.registerManual(req.user, validated(res, 'body', manualDonationSchema)));
  };
  return { list, monthlyTotals, exportCsv, refund, create };
}
