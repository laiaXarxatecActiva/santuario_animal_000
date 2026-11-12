import { z } from 'zod';
import { SIMULATED_OUTCOMES } from '../constants/status.js';

const id = z.number().int().positive();

// CU-13: el adoptante es siempre el usuario de la sesión.
export const createAdoptionSchema = z.object({ animalId: id, planId: id });
export type CreateAdoptionInput = z.infer<typeof createAdoptionSchema>;

// CU-13 pasos 6-7 y CU-14. Nunca se piden datos de tarjeta (RN-13).
export const payAdoptionSchema = z.object({ simulatedOutcome: z.enum(SIMULATED_OUTCOMES).optional() });
export type PayAdoptionInput = z.infer<typeof payAdoptionSchema>;

// GET /api/me/adoptions?animalId=
export const myAdoptionsQuerySchema = z.object({ animalId: z.coerce.number().int().positive().optional() });
export type MyAdoptionsQuery = z.infer<typeof myAdoptionsQuerySchema>;
