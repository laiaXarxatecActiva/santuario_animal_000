import { z } from 'zod';

// CU-19: GET /api/me/contributions?year= filtra los listados (no los totales).
export const contributionsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});
export type ContributionsQuery = z.infer<typeof contributionsQuerySchema>;
