import { describe, expect, it } from 'vitest';
import {
  estaArchivado,
  motivoDeCierre,
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

  it('CU-33: un archivado no cambia de estado', () => {
    expect(puedeCambiarDeEstado('transferred')).toBe(false);
    expect(puedeCambiarDeEstado('in_sanctuary')).toBe(true);
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
