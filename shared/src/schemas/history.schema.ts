import { z } from 'zod';
import { paginationQuerySchema } from './pagination.schema.js';

/** CU-15: el historial se carga de 10 en 10 («Ver más»). */
export const HISTORY_PAGE_SIZE = 10;

// GET /api/me/history?animalId=&page&pageSize (CU-15).
export const historyQuerySchema = paginationQuerySchema.extend({
  pageSize: paginationQuerySchema.shape.pageSize.unwrap().default(HISTORY_PAGE_SIZE),
  animalId: z.coerce.number().int().positive().optional(),
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
