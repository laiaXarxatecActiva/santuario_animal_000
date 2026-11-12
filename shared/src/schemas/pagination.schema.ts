import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

// `?page&pageSize` (TECH_SPEC §10.1).
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// `/:id` de la URL.
export const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
export type IdParams = z.infer<typeof idParamsSchema>;
