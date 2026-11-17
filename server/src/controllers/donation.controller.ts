import { contactSchema, donationSchema } from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { validated } from '../middlewares/validate.js';
import type { ContactService } from '../servicios/contact.service.js';
import type { DonationService } from '../servicios/donation.service.js';

export const CONTACT_MESSAGE = 'Mensaje enviado. Te responderemos lo antes posible.';

// CU-05 y CU-06: solo llaman al caso de uso.
export function createDonationController(donations: DonationService, contact: ContactService) {
  const donate: RequestHandler = async (req, res) => {
    res.status(201).json(await donations.donate(req.user ?? null, validated(res, 'body', donationSchema)));
  };
  const sendContact: RequestHandler = async (_req, res) => {
    await contact.send(validated(res, 'body', contactSchema));
    res.status(202).json({ message: CONTACT_MESSAGE });
  };
  return { donate, sendContact };
}
