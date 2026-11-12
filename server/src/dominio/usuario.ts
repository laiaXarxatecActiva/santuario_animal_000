// Reglas sobre las cuentas de usuario.

/** CU-09 3b: una cuenta desactivada por un administrador o anonimizada (CU-25) no puede iniciar sesión. */
export function cuentaActiva(usuario: { isActive: boolean; anonymizedAt: Date | null }): boolean {
  return usuario.isActive && usuario.anonymizedAt === null;
}
