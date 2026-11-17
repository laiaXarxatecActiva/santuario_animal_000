import { contributionsQuerySchema, idParamsSchema } from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { validated } from '../middlewares/validate.js';
import type { ContributionService } from '../servicios/contribution.service.js';

// CU-19: solo llaman al caso de uso.
export function createContributionController(service: ContributionService) {
  const userId = (req: Parameters<RequestHandler>[0]) => {
    if (!req.user) throw new UnauthorizedError();
    return req.user.id;
  };
  const list: RequestHandler = async (req, res) => {
    res.json(await service.list(userId(req), validated(res, 'query', contributionsQuerySchema)));
  };
  const paymentReceipt: RequestHandler = async (req, res) => {
    res.json(await service.paymentReceipt(userId(req), validated(res, 'params', idParamsSchema).id));
  };
  const donationReceipt: RequestHandler = async (req, res) => {
    res.json(await service.donationReceipt(userId(req), validated(res, 'params', idParamsSchema).id));
  };
  return { list, paymentReceipt, donationReceipt };
}
