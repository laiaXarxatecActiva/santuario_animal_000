import { z } from 'zod';
import { SIMULATED_OUTCOMES } from '../constants/status.js';
import { emailValido, textoOpcional } from './fields.js';

// CU-05 (RN-12): importe libre, mayor que 0 y sin mínimo, con dos decimales como
// máximo. Se trata como texto de principio a fin: nunca se convierte a float.
const IMPORTE_RE = /^(\d{1,8})(?:[.,](\d{1,2}))?$/;

export const donationAmount = z
  .string()
  .trim()
  .regex(IMPORTE_RE, { error: 'Introduce un importe válido, con dos decimales como máximo.' })
  .refine((v) => /[1-9]/.test(v), { error: 'El importe debe ser mayor que 0.' })
  .transform((v) => {
    const [, enteros = '0', decimales = ''] = IMPORTE_RE.exec(v) ?? [];
    return `${enteros.replace(/^0+(?=\d)/, '')}.${decimales.padEnd(2, '0')}`;
  });

export const donationSchema = z.object({
  amount: donationAmount,
  donorName: textoOpcional(200),
  donorEmail: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === '' ? undefined : v))
    .pipe(emailValido.optional()),
  isAnonymous: z.boolean().default(false),
  message: textoOpcional(1000),
  simulatedOutcome: z.enum(SIMULATED_OUTCOMES).optional(),
});
export type DonationInput = z.input<typeof donationSchema>;
export type DonationData = z.output<typeof donationSchema>;
