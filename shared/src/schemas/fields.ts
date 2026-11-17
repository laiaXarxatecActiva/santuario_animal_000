import { z } from 'zod';

// Campos comunes a varios formularios.

// Contraseñas (TECH_SPEC §9.2). El máximo evita que se use un texto enorme para
// cargar el servidor con el cálculo del hash.
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export const nuevaPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { error: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.` })
  .max(PASSWORD_MAX_LENGTH, { error: `La contraseña no puede tener más de ${PASSWORD_MAX_LENGTH} caracteres.` });

/** Texto obligatorio, recortado. */
export const textoObligatorio = (max: number, obligatorio: string) =>
  z
    .string()
    .trim()
    .min(1, { error: obligatorio })
    .max(max, { error: `No puede tener más de ${max} caracteres.` });

/** Email normalizado (sin espacios y en minúsculas). */
export const emailValido = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Introduce un email válido.' }).max(255, { error: 'El email es demasiado largo.' }));

/** Texto opcional: recortado y, si queda vacío, se descarta. */
export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `No puede tener más de ${max} caracteres.` })
    .optional()
    .transform((v) => (v === '' ? undefined : v));
