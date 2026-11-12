import { z } from 'zod';
import { EMAIL_FREQUENCIES, PHONE_PATTERN } from '../constants/users.js';
import { nuevaPassword, textoObligatorio } from './fields.js';

// Móvil español: se aceptan los guiones y espacios que añade el formulario y se
// guarda solo con los dígitos. Vacío = sin teléfono.
const telefono = z
  .string()
  .transform((valor) => valor.replace(/[\s-]/g, ''))
  .refine((valor) => valor === '' || PHONE_PATTERN.test(valor), {
    error: 'Introduce un móvil español de 9 dígitos que empiece por 6 o 7, sin el prefijo +34.',
  })
  .transform((valor) => (valor === '' ? null : valor))
  .nullable();

const nombre = textoObligatorio(100, 'Introduce tu nombre.');
const apellidos = textoObligatorio(150, 'Introduce tus apellidos.');

// CU-23, sección «Tus datos» del formulario.
export const profileDataSchema = z.object({ firstName: nombre, lastName: apellidos, phone: telefono });
export type ProfileDataInput = z.infer<typeof profileDataSchema>;

// CU-23. Cada sección del perfil se guarda por separado, así que todo es
// opcional. El email no se puede cambiar (3b): un campo desconocido es un error.
export const updateProfileSchema = z
  .strictObject({
    firstName: nombre.optional(),
    lastName: apellidos.optional(),
    phone: telefono.optional(),
    emailNotifications: z.boolean().optional(),
    emailFrequency: z.enum(EMAIL_FREQUENCIES).optional(),
    showPublicName: z.boolean().optional(),
  })
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    error: 'No hay cambios que guardar.',
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

const contraseñas = {
  currentPassword: z.string().min(1, { error: 'Introduce tu contraseña actual.' }),
  newPassword: nuevaPassword,
};

// Solo se compara si las dos son válidas por sí mismas.
const sinErroresEn =
  (...campos: string[]) =>
  (payload: { issues: readonly { path?: readonly PropertyKey[] }[] }) =>
    !payload.issues.some((issue) => campos.includes(String(issue.path?.[0])));

const distinta = {
  path: ['newPassword'],
  message: 'La nueva contraseña debe ser distinta de la actual.',
  when: sinErroresEn('currentPassword', 'newPassword'),
};

// CU-24 (PUT /api/me/password). La nueva debe ser distinta de la actual.
export const changePasswordSchema = z.object(contraseñas).refine((d) => d.currentPassword !== d.newPassword, distinta);
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// CU-24 en el formulario: la nueva se escribe dos veces (2b).
export const changePasswordFormSchema = z
  .object({ ...contraseñas, newPasswordConfirm: z.string() })
  .refine((d) => d.currentPassword !== d.newPassword, distinta)
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    path: ['newPasswordConfirm'],
    message: 'Las contraseñas no coinciden.',
    when: sinErroresEn('newPassword', 'newPasswordConfirm'),
  });
export type ChangePasswordFormInput = z.infer<typeof changePasswordFormSchema>;
