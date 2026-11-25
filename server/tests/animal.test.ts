import { describe, expect, it } from 'vitest';
import {
  estaArchivado,
  motivoDeCierre,
  fichaModificable,
  puedeCambiarDeEstado,
  puedeSerAdoptable,
  sePuedeBorrar,
} from '../src/dominio/animal.js';

describe('CU-28 reglas del animal', () => {
  it('RN-22: fallecidos y trasladados están archivados', () => {
    expect(estaArchivado('deceased')).toBe(true);
    expect(estaArchivado('transferred')).toBe(true);
    expect(estaArchivado('in_treatment')).toBe(false);
  });

  it('2b: un archivado no puede ser adoptable', () => {
    expect(puedeSerAdoptable('deceased', true)).toBe(false);
    expect(puedeSerAdoptable('deceased', false)).toBe(true);
    expect(puedeSerAdoptable('in_sanctuary', true)).toBe(true);
  });

  it('CU-33: el estado de un archivado solo lo cambia el administrador (para corregir un error)', () => {
    expect(puedeCambiarDeEstado('transferred', 'caretaker')).toBe(false);
    expect(puedeCambiarDeEstado('deceased', 'caretaker')).toBe(false);
    expect(puedeCambiarDeEstado('transferred', 'admin')).toBe(true);
    expect(puedeCambiarDeEstado('in_sanctuary', 'caretaker')).toBe(true);
  });

  it('RN-22: la información de un archivado solo se consulta', () => {
    expect(fichaModificable('deceased')).toBe(false);
    expect(fichaModificable('transferred')).toBe(false);
    expect(fichaModificable('in_treatment')).toBe(true);
    expect(fichaModificable('in_sanctuary')).toBe(true);
  });

  it('CU-33 5.2: motivo de cierre de las adopciones', () => {
    expect(motivoDeCierre('deceased')).toBe('animal_deceased');
    expect(motivoDeCierre('transferred')).toBe('animal_transferred');
    expect(motivoDeCierre('in_treatment')).toBeNull();
  });

  it('A4 y RN-17: solo se borra sin historial de adopciones', () => {
    expect(sePuedeBorrar(false)).toBe(true);
    expect(sePuedeBorrar(true)).toBe(false);
  });
});
