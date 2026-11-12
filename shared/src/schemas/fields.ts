import { z } from 'zod';

// Campos comunes a varios formularios.

// Contraseñas (TECH_SPEC §9.2). bcrypt solo tiene en cuenta los primeros 72 bytes.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

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
