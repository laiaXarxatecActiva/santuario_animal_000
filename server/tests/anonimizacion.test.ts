import { describe, expect, it } from 'vitest';
import { datosAnonimizados, puedeEliminarCuenta } from '../src/dominio/usuario.js';

describe('CU-25 reglas de la baja', () => {
  it('1a: solo un adoptante elimina su cuenta', () => {
    expect(puedeEliminarCuenta('adopter')).toBe(true);
    expect(puedeEliminarCuenta('caretaker')).toBe(false);
    expect(puedeEliminarCuenta('admin')).toBe(false);
  });

  it('4.2: datos que sustituyen a los personales (TECH_SPEC §13)', () => {
    expect(datosAnonimizados(42)).toEqual({
      firstName: 'Usuario',
      lastName: 'eliminado',
      email: 'deleted-42@anonymized.invalid',
    });
  });
});
