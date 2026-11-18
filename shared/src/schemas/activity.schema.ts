import { z } from 'zod';
import { ACTIVITY_ACTIONS, ACTIVITY_SYSTEM_USER, ACTIVITY_TABLES } from '../constants/activity.js';
import { paginationQuerySchema } from './pagination.schema.js';

const diaOpcional = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Usa el formato AAAA-MM-DD.' })
  .optional()
  .or(z.literal('').transform(() => undefined));

// CU-42 paso 2: filtros por usuario (o «Sistema»), tabla, acción y fechas.
export const adminActivityLogsQuerySchema = paginationQuerySchema
  .extend({
    userId: z
      .union([z.literal(ACTIVITY_SYSTEM_USER), z.coerce.number().int().positive()])
      .optional()
      .or(z.literal('').transform(() => undefined)),
    tableName: z
      .enum(ACTIVITY_TABLES)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    action: z
      .enum(ACTIVITY_ACTIONS)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    from: diaOpcional,
    to: diaOpcional,
  })
  .superRefine((datos, ctx) => {
    if (datos.from && datos.to && datos.from > datos.to) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'La fecha final no puede ser anterior a la inicial.' });
    }
  });
export type AdminActivityLogsQuery = z.infer<typeof adminActivityLogsQuerySchema>;
