import { describe, expect, it } from 'vitest';
import { fechaEnZonaSantuario, relojFijo } from '../src/dominio/reloj.js';

describe('Reloj', () => {
  it('hoy() usa la zona horaria de Madrid, no UTC', () => {
    // 23:30 UTC del 31 de enero = 00:30 del 1 de febrero en Madrid (UTC+1).
    expect(fechaEnZonaSantuario(new Date('2026-01-31T23:30:00Z'))).toBe('2026-02-01');
  });

  it('tiene en cuenta el horario de verano', () => {
    // 22:30 UTC del 30 de junio = 00:30 del 1 de julio en Madrid (UTC+2).
    expect(fechaEnZonaSantuario(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01');
  });

  it('relojFijo devuelve siempre el mismo instante', () => {
    const reloj = relojFijo('2026-11-10T09:00:00Z');
    expect(reloj.ahora().toISOString()).toBe('2026-11-10T09:00:00.000Z');
    expect(reloj.hoy()).toBe('2026-11-10');
  });

  it('modificar la fecha devuelta no altera el reloj', () => {
    const reloj = relojFijo('2026-11-10T09:00:00Z');
    reloj.ahora().setFullYear(2000);
    expect(reloj.ahora().getUTCFullYear()).toBe(2026);
  });

  it('rechaza un instante no válido', () => {
    expect(() => relojFijo('no es una fecha')).toThrow(RangeError);
  });
});
