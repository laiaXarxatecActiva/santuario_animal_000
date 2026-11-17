import { contactSchema, donationSchema } from '@sanctuary/shared';
import { Router } from 'express';
import { createDonationController } from '../controllers/donation.controller.js';
import { createContactLimiter, createDonationLimiter } from '../middlewares/rate-limit.js';
import { validate } from '../middlewares/validate.js';
import type { ContactService } from '../servicios/contact.service.js';
import type { DonationService } from '../servicios/donation.service.js';

// Rutas públicas con sesión opcional (TECH_SPEC §10.3), montadas en /api.
export function createDonationRoutes(donations: DonationService, contact: ContactService): Router {
  const c = createDonationController(donations, contact);
  const router = Router();
  router.post('/donations', createDonationLimiter(), validate({ body: donationSchema }), c.donate);
  router.post('/contact', createContactLimiter(), validate({ body: contactSchema }), c.sendContact);
  return router;
}
