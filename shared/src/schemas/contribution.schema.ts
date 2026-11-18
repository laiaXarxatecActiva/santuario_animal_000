import { z } from 'zod';

// CU-19: GET /api/me/contributions?year= filtra los listados (no los totales).
export const contributionsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});
export type ContributionsQuery = z.infer<typeof contributionsQuerySchema>;

/**
 * CU-19 y CU-22: los PDF se abren en el navegador (para verlos o imprimirlos)
 * o, con `?download=1`, se descargan como archivo.
 */
export const pdfQuerySchema = z.object({
  download: z.literal('1', { error: 'Solo admite el valor 1' }).optional(),
});
export type PdfQuery = z.infer<typeof pdfQuerySchema>;
