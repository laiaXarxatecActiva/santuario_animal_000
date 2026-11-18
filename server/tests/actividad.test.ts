import { describe, expect, it } from 'vitest';
import { cambio, diferencias, limpiarDetalles } from '../src/dominio/actividad.js';

describe('CU-42 detalles del registro de actividad', () => {
  it('nunca guarda contraseñas ni tokens, a ninguna profundidad', () => {
    expect(
      limpiarDetalles({
        name: 'Rufo',
        password: 'x',
        newPassword: 'y',
        invitation: { token: 'abc', expiresIn: '24h' },
        lista: [{ tokenHash: 'z', ok: true }],
      }),
    ).toEqual({ name: 'Rufo', invitation: { expiresIn: '24h' }, lista: [{ ok: true }] });
  });

  it('sin nada que guardar devuelve null y quita los valores indefinidos', () => {
    expect(limpiarDetalles(undefined)).toBeNull();
    expect(limpiarDetalles({ password: 'x', nada: undefined })).toBeNull();
  });

  it('un cambio se guarda como [antes, después] solo si cambia', () => {
    expect(cambio('active', 'paused')).toEqual(['active', 'paused']);
    expect(cambio(true, true)).toBeUndefined();
  });
});

describe('CU-42 diferencias entre versiones', () => {
  it('solo anota los campos simples que cambian, sin las fechas de control', () => {
    expect(
      diferencias(
        { name: 'Rufo', isPublished: false, notes: null, updatedAt: 'a', photos: [1] },
        { name: 'Rufo', isPublished: true, notes: 'Hola', updatedAt: 'b', photos: [2], nuevo: 1 },
      ),
    ).toEqual({ isPublished: [false, true], notes: [null, 'Hola'] });
  });
});
