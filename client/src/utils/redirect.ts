import { isWorkerRole, type SessionUser } from '@sanctuary/shared';

// Destinos tras iniciar sesión (CU-09 paso 5): el trabajador va al escritorio del panel (CU-27).
export const ADOPTER_HOME = '/my-animals';
export const WORKER_HOME = '/admin';

/** Solo rutas internas de la aplicación: evita redirecciones a otras webs (`//web`, `https://…`). */
export function safeNext(valor: string | null | undefined): string | undefined {
  if (!valor || !valor.startsWith('/') || valor.startsWith('//') || valor.startsWith('/\\')) return undefined;
  return valor;
}

/** El adoptante vuelve a la página de origen; el trabajador va siempre a su inicio. */
export function homeFor(user: SessionUser, next: string | undefined): string {
  if (isWorkerRole(user.role)) return WORKER_HOME;
  return next ?? ADOPTER_HOME;
}
