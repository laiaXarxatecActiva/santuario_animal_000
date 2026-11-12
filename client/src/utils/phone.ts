import { PHONE_DIGITS } from '@sanctuary/shared';

/**
 * Teléfono móvil mientras se escribe (CU-23): solo dígitos, como mucho 9, y los
 * guiones se añaden solos para leerlo mejor: `612-34-56-78`.
 */
export function formatPhone(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, PHONE_DIGITS);
  const grupos = [digitos.slice(0, 3), digitos.slice(3, 5), digitos.slice(5, 7), digitos.slice(7, 9)];
  return grupos.filter(Boolean).join('-');
}
