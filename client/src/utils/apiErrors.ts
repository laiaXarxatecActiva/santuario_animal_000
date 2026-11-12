import type { TFunction } from 'i18next';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '../api/client';

/**
 * Mensaje para el usuario: el de `errors.<código>` si existe y, si no, el
 * genérico. Nunca se muestran detalles técnicos.
 */
export function errorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    const clave = `errors.${error.code}`;
    if (t(clave) !== clave) return t(clave);
  }
  return t('errors.generic');
}

/** Pasa los errores por campo del servidor (`details`) a react-hook-form. */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  campos: readonly Path<T>[],
): void {
  if (!(error instanceof ApiError)) return;
  for (const { field, message } of error.details) {
    const campo = campos.find((c) => c === field);
    if (campo) setError(campo, { type: 'server', message });
  }
}
