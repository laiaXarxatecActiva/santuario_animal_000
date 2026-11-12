import { describe, expect, it, vi } from 'vitest';
import i18n from '../src/i18n';
import { ApiError } from '../src/api/client';
import { applyFieldErrors, errorMessage } from '../src/utils/apiErrors';

const t = i18n.t.bind(i18n);

describe('errores de la API en la interfaz', () => {
  it('traduce los códigos conocidos', () => {
    expect(errorMessage(t, new ApiError(401, 'INVALID_CREDENTIALS', 'x'))).toBe('Email o contraseña incorrectos.');
  });

  it('usa el mensaje genérico para códigos desconocidos y errores que no son de la API', () => {
    expect(errorMessage(t, new ApiError(500, 'INTERNAL_ERROR', 'stack...'))).toBe(
      'Algo ha ido mal; inténtalo de nuevo.',
    );
    expect(errorMessage(t, new TypeError('Failed to fetch'))).toBe('Algo ha ido mal; inténtalo de nuevo.');
  });

  it('pasa a cada campo conocido su error del servidor', () => {
    const setError = vi.fn();
    const error = new ApiError(400, 'VALIDATION_ERROR', 'x', [
      { field: 'email', message: 'Mal' },
      { field: 'otro', message: 'Ignorado' },
    ]);
    applyFieldErrors<{ email: string }>(error, setError, ['email']);
    expect(setError).toHaveBeenCalledExactlyOnceWith('email', { type: 'server', message: 'Mal' });
  });
});
