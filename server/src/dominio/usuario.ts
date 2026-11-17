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

/** CU-25 1a: solo un adoptante elimina su cuenta; la de un trabajador la desactiva un administrador. */
export function puedeEliminarCuenta(role: Role): boolean {
  return role === 'adopter';
}

/** CU-25 4.2 y TECH_SPEC §13: datos que sustituyen a los personales al anonimizar. */
export function datosAnonimizados(id: number): { firstName: string; lastName: string; email: string } {
  return { firstName: 'Usuario', lastName: 'eliminado', email: `deleted-${id}@anonymized.invalid` };
}
