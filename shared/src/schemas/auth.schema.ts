import { z } from 'zod';

// Contraseñas (TECH_SPEC §9.2). bcrypt solo tiene en cuenta los primeros 72 bytes.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Introduce un email válido.' }).max(255, { error: 'El email es demasiado largo.' }));

const nuevaPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { error: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.` })
  .max(PASSWORD_MAX_LENGTH, { error: `La contraseña no puede tener más de ${PASSWORD_MAX_LENGTH} caracteres.` });

const texto = (max: number, obligatorio: string) =>
  z
    .string()
    .trim()
    .min(1, { error: obligatorio })
    .max(max, { error: `No puede tener más de ${max} caracteres.` });

const coinciden = <T extends { password: string; passwordConfirm: string }>(datos: T) =>
  datos.password === datos.passwordConfirm;
const errorCoinciden = { path: ['passwordConfirm'], message: 'Las contraseñas no coinciden.' };

// CU-07. Cualquier otro campo (como `role`) se descarta (RN-02).
export const registerSchema = z
  .object({
    firstName: texto(100, 'Introduce tu nombre.'),
    lastName: texto(150, 'Introduce tus apellidos.'),
    email,
    password: nuevaPassword,
    passwordConfirm: z.string(),
    privacyAccepted: z.literal(true, { error: 'Tienes que aceptar la política de privacidad.' }),
  })
  .refine(coinciden, errorCoinciden);
export type RegisterInput = z.infer<typeof registerSchema>;

// CU-09. La contraseña no se valida: las de TEST_DATA.sql no cumplen el mínimo.
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, { error: 'Introduce tu email.' }),
  password: z.string().min(1, { error: 'Introduce tu contraseña.' }),
});
export type LoginInput = z.infer<typeof loginSchema>;

// CU-08: token del enlace del email.
export const tokenSchema = z.object({
  token: z.string().min(1).max(200),
});
export type TokenInput = z.infer<typeof tokenSchema>;

// CU-10.
export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = tokenSchema
  .extend({ password: nuevaPassword, passwordConfirm: z.string() })
  .refine(coinciden, errorCoinciden);
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
