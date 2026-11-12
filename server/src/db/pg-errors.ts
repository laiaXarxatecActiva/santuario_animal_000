// Códigos de error de PostgreSQL que los modelos traducen a errores de negocio.
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';
export const PG_CHECK_VIOLATION = '23514';

/** ¿Es un error de PostgreSQL con este código (y, si se indica, sobre esta restricción)? */
export function esErrorPg(error: unknown, codigo: string, restriccion?: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, constraint } = error as { code?: unknown; constraint?: unknown };
  return code === codigo && (restriccion === undefined || constraint === restriccion);
}
