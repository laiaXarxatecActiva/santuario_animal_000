import { isWorkerRole, type Role, type UserAccountStatus } from '@sanctuary/shared';

// Reglas de la gestión de usuarios del panel (CU-35, CU-36, CU-51).

interface Cuenta {
  id: number;
  role: Role;
  isActive: boolean;
  anonymizedAt: Date | null;
}

export type ProblemaCuenta =
  | 'CANNOT_DEACTIVATE_SELF'
  | 'ANONYMIZED_CANNOT_REACTIVATE'
  | 'ROLE_CHANGE_NOT_ALLOWED'
  | 'LAST_ACTIVE_ADMIN'
  | 'CANNOT_DELETE_SELF'
  | 'ALREADY_ANONYMIZED';

/** Estado que se muestra en el panel. */
export function estadoCuenta(cuenta: { isActive: boolean; anonymizedAt: Date | null }): UserAccountStatus {
  if (cuenta.anonymizedAt !== null) return 'anonymized';
  return cuenta.isActive ? 'active' : 'inactive';
}

/** 4, 4b y 4c: activar o desactivar una cuenta. */
export function comprobarCambioEstado(
  cuenta: Cuenta,
  { actorId, activar }: { actorId: number; activar: boolean },
): ProblemaCuenta | null {
  if (!activar && cuenta.id === actorId) return 'CANNOT_DEACTIVATE_SELF';
  if (activar && cuenta.anonymizedAt !== null) return 'ANONYMIZED_CANNOT_REACTIVATE';
  return null;
}

/**
 * A1: el rol solo cambia entre cuidador y administrador (RN-01, RN-03), y el
 * último administrador activo no puede dejar de serlo.
 */
export function comprobarCambioRol(
  cuenta: Cuenta,
  { nuevoRol, adminsActivos }: { nuevoRol: Role; adminsActivos: number },
): ProblemaCuenta | null {
  if (!isWorkerRole(cuenta.role) || !isWorkerRole(nuevoRol)) return 'ROLE_CHANGE_NOT_ALLOWED';
  const pierdeAdmin = cuenta.role === 'admin' && nuevoRol !== 'admin';
  if (pierdeAdmin && cuenta.isActive && adminsActivos <= 1) return 'LAST_ACTIVE_ADMIN';
  return null;
}

/** CU-36 4a: la invitación se puede reenviar a un trabajador activo que nunca ha entrado. */
export function puedeReenviarInvitacion(cuenta: { role: Role; isActive: boolean; lastLoginAt: Date | null }): boolean {
  return isWorkerRole(cuenta.role) && cuenta.isActive && cuenta.lastLoginAt === null;
}

/**
 * CU-51: el administrador puede enviar el enlace para cambiar la contraseña a
 * un trabajador activo (cuidador u otro administrador), nunca a un adoptante ni
 * a sí mismo (su contraseña se cambia en «Mi perfil», CU-24).
 */
export function puedeEnviarCambioPassword(cuenta: Cuenta, actorId: number): boolean {
  return isWorkerRole(cuenta.role) && cuenta.isActive && cuenta.anonymizedAt === null && cuenta.id !== actorId;
}

/**
 * CU-75 1a: el administrador borra del todo cualquier cuenta menos la suya
 * (también una anonimizada). No hace falta comprobar el «último administrador»:
 * quien borra ya es un administrador activo.
 */
export function comprobarEliminacion(cuenta: Cuenta, actorId: number): ProblemaCuenta | null {
  return cuenta.id === actorId ? 'CANNOT_DELETE_SELF' : null;
}

/** CU-76: anonimizar cualquier cuenta menos la propia, y solo una vez. */
export function comprobarAnonimizacion(cuenta: Cuenta, actorId: number): ProblemaCuenta | null {
  if (cuenta.id === actorId) return 'CANNOT_DELETE_SELF';
  if (cuenta.anonymizedAt !== null) return 'ALREADY_ANONYMIZED';
  return null;
}
