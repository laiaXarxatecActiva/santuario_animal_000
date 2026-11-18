import { describe, expect, it } from 'vitest';
import { comprobarFechaRegistro } from '../src/dominio/veterinario.js';

describe('CU-34 fecha de un registro veterinario', () => {
  it('4a: hoy y los días pasados valen; una fecha futura no', () => {
    expect(comprobarFechaRegistro('2026-11-18', '2026-11-18')).toBeNull();
    expect(comprobarFechaRegistro('2020-02-29', '2026-11-18')).toBeNull();
    expect(comprobarFechaRegistro('2026-11-19', '2026-11-18')).toBe('DATE_IN_FUTURE');
  });

  it('una fecha que no existe en el calendario no vale', () => {
    expect(comprobarFechaRegistro('2026-02-30', '2026-11-18')).toBe('INVALID_DATE');
  });
});
