import { isWorkerRole, type SessionUser } from '@sanctuary/shared';

// Destinos tras iniciar sesión (CU-09 paso 5). Provisionales hasta que existan
// «Mis animales» (CU-15: /my-animals) y el escritorio del panel (CU-27: /admin).
export const ADOPTER_HOME = '/animals';
export const WORKER_HOME = '/';

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
