import { idParamsSchema, pdfQuerySchema } from '@sanctuary/shared';
import { Router } from 'express';
import { createDocumentController } from '../controllers/document.controller.js';
import { requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import type { DocumentService } from '../servicios/document.service.js';

// CU-22 certificado y CU-19 recibos en PDF (TECH_SPEC §10.4), montada en /api.
export function createDocumentRoutes(service: DocumentService): Router {
  const c = createDocumentController(service);
  const router = Router();
  const entrada = validate({ params: idParamsSchema, query: pdfQuerySchema });
  router.get('/me/adoptions/:id/certificate', requireRole('adopter'), entrada, c.certificate);
  router.get('/me/payments/:id/receipt.pdf', requireRole('adopter'), entrada, c.paymentReceipt);
  router.get('/me/donations/:id/receipt.pdf', requireRole('adopter'), entrada, c.donationReceipt);
  return router;
}
