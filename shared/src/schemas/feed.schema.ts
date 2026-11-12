import { z } from 'zod';
import { paginationQuerySchema } from './pagination.schema.js';

// GET /api/me/feed?unread=true&animalId=&page&pageSize (CU-17).
export const feedQuerySchema = paginationQuerySchema.extend({
  unread: z
    .enum(['true', 'false'])
    .transform((valor) => valor === 'true')
    .default(false),
  animalId: z.coerce.number().int().positive().optional(),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;

// PUT/DELETE /api/me/feed/:updateId/read
export const updateIdParamsSchema = z.object({ updateId: z.coerce.number().int().positive() });
export type UpdateIdParams = z.infer<typeof updateIdParamsSchema>;
