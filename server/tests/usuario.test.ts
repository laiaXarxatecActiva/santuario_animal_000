import { describe, expect, it } from 'vitest';
import { cuentaActiva } from '../src/dominio/usuario.js';

describe('CU-09 cuentaActiva', () => {
  it('una cuenta activa y sin anonimizar puede entrar', () => {
    expect(cuentaActiva({ isActive: true, anonymizedAt: null })).toBe(true);
  });

  it('3b: una cuenta desactivada o anonimizada no puede entrar', () => {
    expect(cuentaActiva({ isActive: false, anonymizedAt: null })).toBe(false);
    expect(cuentaActiva({ isActive: false, anonymizedAt: new Date('2026-07-01T00:00:00Z') })).toBe(false);
  });
});
