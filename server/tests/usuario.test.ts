import { describe, expect, it } from 'vitest';
import { cuentaActiva, tienePreferenciasDeAdoptante } from '../src/dominio/usuario.js';

describe('CU-09 cuentaActiva', () => {
  it('una cuenta activa y sin anonimizar puede entrar', () => {
    expect(cuentaActiva({ isActive: true, anonymizedAt: null })).toBe(true);
  });

  it('3b: una cuenta desactivada o anonimizada no puede entrar', () => {
    expect(cuentaActiva({ isActive: false, anonymizedAt: null })).toBe(false);
    expect(cuentaActiva({ isActive: false, anonymizedAt: new Date('2026-07-01T00:00:00Z') })).toBe(false);
  });
});

describe('CU-23 tienePreferenciasDeAdoptante', () => {
  it('solo los adoptantes eligen aparecer en las fichas y sus emails de novedades (RN-16, RN-19)', () => {
    expect(tienePreferenciasDeAdoptante('adopter')).toBe(true);
    expect(tienePreferenciasDeAdoptante('caretaker')).toBe(false);
    expect(tienePreferenciasDeAdoptante('admin')).toBe(false);
  });
});
