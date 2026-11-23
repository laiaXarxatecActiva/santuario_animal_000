import { z } from 'zod';
import { PAYMENT_MODES, SIMULATED_OUTCOMES } from '../constants/status.js';

const id = z.number().int().positive();

const paymentMode = z.enum(PAYMENT_MODES, { error: 'Elige la forma de pago.' });

// CU-13: el adoptante es siempre el usuario de la sesión. CU-49: sin forma de
// pago, el servidor usa la automática.
export const createAdoptionSchema = z.object({ animalId: id, planId: id, paymentMode: paymentMode.optional() });
export type CreateAdoptionInput = z.infer<typeof createAdoptionSchema>;

// CU-13 pasos 6-7 y CU-14. Nunca se piden datos de tarjeta (RN-13).
export const payAdoptionSchema = z.object({ simulatedOutcome: z.enum(SIMULATED_OUTCOMES).optional() });
export type PayAdoptionInput = z.infer<typeof payAdoptionSchema>;

// GET /api/me/adoptions?animalId=
export const myAdoptionsQuerySchema = z.object({ animalId: z.coerce.number().int().positive().optional() });
export type MyAdoptionsQuery = z.infer<typeof myAdoptionsQuerySchema>;

// CU-20: el plan elegido para la próxima cuota (el actual anula el cambio programado).
export const changePlanSchema = z.object({ planId: id });
export type ChangePlanInput = z.infer<typeof changePlanSchema>;

// CU-49: cambiar la forma de pago de una adopción.
export const changePaymentModeSchema = z.object({ paymentMode });
export type ChangePaymentModeInput = z.infer<typeof changePaymentModeSchema>;
