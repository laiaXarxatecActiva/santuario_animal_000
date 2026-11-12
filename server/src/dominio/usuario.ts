import type { Role } from '@sanctuary/shared';

// Reglas sobre las cuentas de usuario.

/** CU-09 3b: una cuenta desactivada por un administrador o anonimizada (CU-25) no puede iniciar sesión. */
export function cuentaActiva(usuario: { isActive: boolean; anonymizedAt: Date | null }): boolean {
  return usuario.isActive && usuario.anonymizedAt === null;
}

/**
 * CU-23: aparecer en la ficha de los animales (RN-16) y recibir emails de sus
 * novedades (RN-19) solo tiene sentido para los adoptantes.
 */
export function tienePreferenciasDeAdoptante(role: Role): boolean {
  return role === 'adopter';
}
