import { describe, expect, it } from 'vitest';
import { caducidadToken, DURACION_TOKEN_MS, estadoToken } from '../src/dominio/token.js';

const ahora = new Date('2026-11-12T10:00:00Z');

describe('CU-08 y CU-10 tokens de un solo uso', () => {
  it('la verificación de email caduca en 24 horas', () => {
    expect(caducidadToken('email_verification', ahora).toISOString()).toBe('2026-11-13T10:00:00.000Z');
  });

  it('la recuperación de contraseña caduca en 1 hora', () => {
    expect(caducidadToken('password_reset', ahora).toISOString()).toBe('2026-11-12T11:00:00.000Z');
    expect(DURACION_TOKEN_MS.password_reset).toBe(60 * 60 * 1000);
  });

  it('un token sin usar y sin caducar es válido', () => {
    expect(estadoToken({ expiresAt: new Date('2026-11-12T10:00:01Z'), usedAt: null }, ahora)).toBe('valid');
  });

  it('un token caduca en el instante de caducidad', () => {
    expect(estadoToken({ expiresAt: ahora, usedAt: null }, ahora)).toBe('expired');
  });

  it('un token usado ya no vale aunque no haya caducado', () => {
    expect(estadoToken({ expiresAt: new Date('2026-11-13T00:00:00Z'), usedAt: ahora }, ahora)).toBe('used');
  });
});
