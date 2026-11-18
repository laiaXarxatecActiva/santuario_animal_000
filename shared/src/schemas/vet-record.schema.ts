import { z } from 'zod';
import { VET_RECORD_TYPES } from '../constants/animals.js';
import { textoObligatorio } from './fields.js';

/** Peso en kg con coma o punto y dos decimales como máximo (NUMERIC(6,2)). */
const PESO_RE = /^(\d{1,4})(?:[.,](\d{1,2}))?$/;

const peso = z
  .string()
  .trim()
  .regex(PESO_RE, { error: 'Escribe el peso en kg, con dos decimales como máximo.' })
  .refine((v) => /[1-9]/.test(v), { error: 'El peso debe ser mayor que 0.' })
  .transform((v) => {
    const [, enteros = '0', decimales = ''] = PESO_RE.exec(v) ?? [];
    return `${enteros.replace(/^0+(?=\d)/, '')}.${decimales.padEnd(2, '0')}`;
  });

/**
 * CU-34 paso 3: fecha, tipo, descripción, peso (opcional) y veterinario. Que la
 * fecha no sea futura lo comprueba el servidor (depende de hoy); el cliente
 * avisa antes con `max`.
 */
export const vetRecordBodySchema = z.object({
  recordDate: z.iso.date({ error: 'Elige la fecha.' }),
  type: z.enum(VET_RECORD_TYPES, { error: 'Elige el tipo.' }),
  description: textoObligatorio(5000, 'Escribe la descripción.'),
  weightKg: z
    .union([peso, z.literal('').transform(() => null), z.null()])
    .optional()
    .transform((v) => v ?? null),
  veterinarian: z
    .string()
    .trim()
    .max(150, { error: 'No puede tener más de 150 caracteres.' })
    .nullish()
    .transform((v) => (v ? v : null)),
});
export type VetRecordBody = z.input<typeof vetRecordBodySchema>;
export type VetRecordData = z.output<typeof vetRecordBodySchema>;
