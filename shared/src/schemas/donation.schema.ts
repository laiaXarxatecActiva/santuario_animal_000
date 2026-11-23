import { LANGUAGES } from '../constants/languages.js';
import { z } from 'zod';
import { SIMULATED_OUTCOMES } from '../constants/status.js';
import { emailValido, telefono, textoObligatorio, textoOpcional } from './fields.js';

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

/** Letras de control del DNI y del NIE (resto de dividir el número entre 23). */
const LETRAS_NIF = 'TRWAGMYFPDXBNJZSQVHLCKE';

/** DNI (8 dígitos y letra) o NIE (X, Y o Z, 7 dígitos y letra), con la letra correcta. */
export function nifValido(valor: string): boolean {
  const m = /^([XYZ]?)(\d{7,8})([A-Z])$/.exec(valor);
  if (!m) return false;
  const [, prefijo = '', numero = '', letra] = m;
  if ((prefijo === '' ? 8 : 7) !== numero.length) return false;
  const completo = Number(`${'XYZ'.indexOf(prefijo) === -1 ? '' : 'XYZ'.indexOf(prefijo)}${numero}`);
  return LETRAS_NIF[completo % 23] === letra;
}

/** Código postal español: 5 dígitos que empiezan por el código de una provincia (01 a 52). */
const CODIGO_POSTAL_RE = /^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/;

/** Campos que solo se piden con el certificado para desgravar, con su mensaje si faltan. */
const DATOS_FISCALES = {
  donorTaxId: 'Escribe tu NIF.',
  donorAddress: 'Escribe tu dirección.',
  donorPostalCode: 'Escribe el código postal.',
  donorProvince: 'Escribe la provincia.',
  donorCountry: 'Escribe el país.',
} as const;

export const donationSchema = z
  .object({
    amount: donationAmount,
    donorName: textoObligatorio(100, 'Escribe tu nombre.'),
    donorSurname: textoObligatorio(100, 'Escribe tus apellidos.'),
    // Obligatorio: se usa para avisar de la operación (recibo, devoluciones).
    donorEmail: emailValido,
    donorPhone: telefono.optional().transform((v) => v ?? null),
    isAnonymous: z.boolean().default(false),
    message: textoOpcional(1000),
    acceptPrivacy: z.literal(true, { error: 'Debes aceptar la política de privacidad.' }),
    taxCertificate: z.boolean().default(false),
    donorTaxId: textoOpcional(20).transform((v) => v?.toUpperCase()),
    donorAddress: textoOpcional(200),
    donorPostalCode: textoOpcional(10),
    donorProvince: textoOpcional(100),
    donorCountry: textoOpcional(100),
    simulatedOutcome: z.enum(SIMULATED_OUTCOMES).optional(),
    /** Fase 3: idioma de la web al donar, para el email de agradecimiento sin cuenta. */
    language: z.enum(LANGUAGES).optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.taxCertificate) return;
    for (const [campo, mensaje] of Object.entries(DATOS_FISCALES)) {
      if (!d[campo as keyof typeof DATOS_FISCALES]) ctx.addIssue({ code: 'custom', path: [campo], message: mensaje });
    }
    if (d.donorTaxId && !nifValido(d.donorTaxId)) {
      ctx.addIssue({ code: 'custom', path: ['donorTaxId'], message: 'El NIF no es válido.' });
    }
    if (d.donorPostalCode && !CODIGO_POSTAL_RE.test(d.donorPostalCode)) {
      ctx.addIssue({ code: 'custom', path: ['donorPostalCode'], message: 'El código postal no es válido.' });
    }
  })
  // Sin el certificado no se guardan datos fiscales, aunque lleguen.
  .transform((d) =>
    d.taxCertificate
      ? d
      : {
          ...d,
          donorTaxId: undefined,
          donorAddress: undefined,
          donorPostalCode: undefined,
          donorProvince: undefined,
          donorCountry: undefined,
        },
  );
export type DonationInput = z.input<typeof donationSchema>;
export type DonationData = z.output<typeof donationSchema>;
